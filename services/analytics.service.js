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
            console.log(`[Socket] New connection: ${socket.id}`);

            socket.on('register', async (data) => {
                const { userId, sessionId, role, device } = data;
                const identifier = userId || sessionId;

                if (!identifier) {
                    console.log(`[Socket] Register failed: No identifier for socket ${socket.id}`);
                    return;
                }

                console.log(`[Socket] Registering: ${identifier} (Role: ${role}, ID: ${socket.id})`);

                this.socketToUser.set(socket.id, identifier);

                if (this.activeUsers.has(identifier)) {
                    const existing = this.activeUsers.get(identifier);
                    existing.sockets.add(socket.id);
                    existing.lastActive = Date.now();
                } else {
                    let userData = {
                        userId: identifier,
                        isGuest: !userId,
                        fullName: 'Khách viếng thăm',
                        avatar: null,
                        role: role || 'GUEST',
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
                                userData.role = dbUser.role.toUpperCase();
                            }
                        } catch (e) {
                            console.error(`[Socket] DB Error for ${userId}:`, e.message);
                        }
                    }
                    this.activeUsers.set(identifier, userData);
                }

                // Gửi ngay cho chính người vừa vào
                this.sendCurrentStats(socket);
                // Cập nhật cho tất cả mọi người
                this.broadcastStats();
            });

            socket.on('heartbeat', () => {
                const identifier = this.socketToUser.get(socket.id);
                if (identifier && this.activeUsers.has(identifier)) {
                    this.activeUsers.get(identifier).lastActive = Date.now();
                }
            });

            socket.on('disconnect', () => {
                const identifier = this.socketToUser.get(socket.id);
                console.log(`[Socket] Disconnected: ${socket.id} (Identifier: ${identifier})`);

                if (identifier) {
                    const userData = this.activeUsers.get(identifier);
                    if (userData) {
                        userData.sockets.delete(socket.id);
                        if (userData.sockets.size === 0) {
                            // Chờ 10 giây để chắc chắn không phải do reload trang
                            setTimeout(() => {
                                const latestData = this.activeUsers.get(identifier);
                                if (latestData && latestData.sockets.size === 0) {
                                    this.activeUsers.delete(identifier);
                                    console.log(`[Socket] Cleaned up user: ${identifier}`);
                                    this.broadcastStats();
                                }
                            }, 10000);
                        }
                    }
                    this.socketToUser.delete(socket.id);
                }
            });
        });

        setInterval(() => this.cleanup(), 30000);
    }

    sendCurrentStats(socket) {
        const { stats, list } = this.getFormattedData();
        socket.emit('online_stats', stats);
        socket.emit('online_users_list', list);
    }

    broadcastStats() {
        if (!this.io) return;
        const { stats, list } = this.getFormattedData();
        this.io.emit('online_stats', stats);
        this.io.emit('online_users_list', list);
    }

    getFormattedData() {
        let guests = 0;
        const onlineUsersList = [];
        this.activeUsers.forEach((user) => {
            if (user.isGuest) guests++;
            else {
                onlineUsersList.push({
                    userId: user.userId,
                    fullName: user.fullName,
                    avatar: user.avatar,
                    role: user.role,
                    device: user.device
                });
            }
        });
        return {
            stats: { users: onlineUsersList.length, guests, total: onlineUsersList.length + guests },
            list: onlineUsersList
        };
    }

    cleanup() {
        const now = Date.now();
        let changed = false;
        this.activeUsers.forEach((user, key) => {
            if (now - user.lastActive > 120000) { // 2 phút
                this.activeUsers.delete(key);
                changed = true;
            }
        });
        if (changed) this.broadcastStats();
    }

    getOnlineStats() {
        const { stats } = this.getFormattedData();
        return { success: true, data: stats };
    }
}

module.exports = new AnalyticsService();