const User = require('../modules/user/user.model');

class AnalyticsService {
    constructor() {
        this.io = null;
        this.activeUsers = new Map();
        this.socketToUser = new Map();
    }

    init(io) {
        this.io = io;
        this.io.on('connection', (socket) => {
            socket.on('register', async (data) => {
                const { userId, sessionId, role, device } = data;
                const identifier = userId || sessionId;
                if (!identifier) return;

                this.socketToUser.set(socket.id, identifier);

                if (this.activeUsers.has(identifier)) {
                    const existing = this.activeUsers.get(identifier);
                    existing.sockets.add(socket.id);
                    existing.lastActive = Date.now();
                    existing.device = device || existing.device;
                    if (userId && existing.isGuest) {
                        const dbUser = await User.findById(userId).select('fullName avatar role').lean();
                        if (dbUser) {
                            existing.isGuest = false;
                            existing.userId = userId;
                            existing.fullName = dbUser.fullName;
                            existing.avatar = dbUser.avatar;
                            existing.role = dbUser.role;
                        }
                    }
                } else {
                    let userData = {
                        userId: identifier,
                        isGuest: !userId,
                        fullName: 'Khách viếng thăm',
                        avatar: null,
                        role: role || 'guest',
                        device: device || 'Unknown',
                        sockets: new Set([socket.id]),
                        lastActive: Date.now()
                    };

                    if (userId) {
                        try {
                            const dbUser = await User.findById(userId).select('fullName avatar role').lean();
                            if (dbUser) {
                                userData.fullName = dbUser.fullName;
                                userData.avatar = dbUser.avatar;
                                userData.role = dbUser.role;
                            }
                        } catch (e) { }
                    }
                    this.activeUsers.set(identifier, userData);
                }
                this.broadcastStats();
            });

            socket.on('disconnect', () => {
                const identifier = this.socketToUser.get(socket.id);
                if (identifier) {
                    const userData = this.activeUsers.get(identifier);
                    if (userData) {
                        userData.sockets.delete(socket.id);
                        if (userData.sockets.size === 0) {
                            this.activeUsers.delete(identifier);
                        }
                    }
                    this.socketToUser.delete(socket.id);
                }
                this.broadcastStats();
            });
        });

        setInterval(() => this.cleanup(), 60000);
    }

    broadcastStats() {
        if (!this.io) return;
        let guests = 0;
        const onlineUsersList = [];

        this.activeUsers.forEach((user) => {
            if (user.isGuest) {
                guests++;
            } else {
                onlineUsersList.push({
                    userId: user.userId,
                    fullName: user.fullName,
                    avatar: user.avatar,
                    role: user.role,
                    device: user.device
                });
            }
        });

        this.io.emit('online_stats', {
            users: onlineUsersList.length,
            guests: guests,
            total: onlineUsersList.length + guests
        });
        this.io.emit('online_users_list', onlineUsersList);
    }

    cleanup() {
        const now = Date.now();
        this.activeUsers.forEach((user, key) => {
            if (now - user.lastActive > 120000) this.activeUsers.delete(key);
        });
        this.broadcastStats();
    }
}

module.exports = new AnalyticsService();