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
            console.log(`🔌 New socket connected: ${socket.id}`);

            socket.on('ping', () => {
                console.log(`💓 PING from ${socket.id}, sending PONG`);
                socket.emit('pong');
            });

            socket.on('heartbeat', () => {
                console.log(`💓 HEARTBEAT from ${socket.id}`);
                const identifier = this.socketToUser.get(socket.id);
                if (identifier && this.activeUsers.has(identifier)) {
                    this.activeUsers.get(identifier).lastActive = Date.now();
                }
                socket.emit('pong', { timestamp: Date.now() });
            });

            // ========== REGISTER ==========
            socket.on('register', async (data) => {
                console.log(`📝 Register received:`, data);

                const { userId, sessionId, role, device } = data;
                const identifier = userId || sessionId;
                if (!identifier) return;

                const isGuest = !userId;
                this.socketToUser.set(socket.id, identifier);

                if (this.activeUsers.has(identifier)) {
                    const existingData = this.activeUsers.get(identifier);
                    existingData.sockets.add(socket.id);
                    if (device) existingData.device = device;
                    existingData.lastActive = Date.now();
                } else {
                    let fullName = isGuest ? 'Khách viếng thăm' : 'Người dùng';
                    let avatar = null;
                    let userRole = role || 'user';

                    if (!isGuest) {
                        try {
                            const dbUser = await User.findById(userId).select('fullName avatar role').lean();
                            if (dbUser) {
                                fullName = dbUser.fullName;
                                avatar = dbUser.avatar;
                                userRole = dbUser.role || userRole;
                            }
                        } catch (error) {
                            console.error('Lỗi khi lấy thông tin user:', error);
                        }
                    }

                    this.activeUsers.set(identifier, {
                        userId: identifier,
                        isGuest,
                        fullName,
                        avatar,
                        role: userRole,
                        device: device || 'Unknown',
                        sockets: new Set([socket.id]),
                        lastActive: Date.now()
                    });

                    if (!isGuest) {
                        this.io.emit('user_online', this.activeUsers.get(identifier));
                    }
                }

                this.broadcastStats();
                console.log(`✅ Registered: ${identifier} (guest: ${isGuest})`);
            });

            // ========== USER ACTIVITY ==========
            socket.on('user_activity', () => {
                const identifier = this.socketToUser.get(socket.id);
                if (identifier && this.activeUsers.has(identifier)) {
                    this.activeUsers.get(identifier).lastActive = Date.now();
                }
            });

            // ========== ROOM HANDLERS ==========
            socket.on('join_post_room', ({ postSlug }) => {
                socket.join(`post:${postSlug}`);
                console.log(`📚 Socket ${socket.id} joined post:${postSlug}`);
            });

            socket.on('leave_post_room', ({ postSlug }) => {
                socket.leave(`post:${postSlug}`);
                console.log(`📚 Socket ${socket.id} left post:${postSlug}`);
            });

            // ========== DISCONNECT ==========
            socket.on('disconnect', () => {
                const identifier = this.socketToUser.get(socket.id);
                if (identifier) {
                    const userData = this.activeUsers.get(identifier);
                    if (userData) {
                        userData.sockets.delete(socket.id);
                        if (userData.sockets.size === 0) {
                            this.activeUsers.delete(identifier);
                            if (!userData.isGuest) {
                                this.io.emit('user_offline', { userId: identifier });
                            }
                        }
                    }
                    this.socketToUser.delete(socket.id);
                    this.broadcastStats();
                }
                console.log(`🔌 Socket disconnected: ${socket.id}`);
            });

            socket.on('error', (error) => {
                console.error(`⚠️ Socket error:`, error.message);
            });
        });

        // Dọn dẹp user không hoạt động sau 2 phút
        setInterval(() => this.cleanupGhostUsers(), 120000);
    }

    broadcastStats() {
        if (!this.io) return;

        let registeredUsers = 0;
        let guests = 0;
        const onlineUsersList = [];

        for (const [key, user] of this.activeUsers.entries()) {
            if (user.isGuest) {
                guests++;
            } else {
                registeredUsers++;
                onlineUsersList.push({
                    userId: user.userId,
                    fullName: user.fullName,
                    avatar: user.avatar,
                    role: user.role,
                    device: user.device
                });
            }
        }

        console.log(`📡 Broadcasting: ${registeredUsers} users online, ${guests} guests`);

        this.io.emit('online_stats', {
            users: registeredUsers,
            guests: guests,
            total: registeredUsers + guests
        });
        this.io.emit('online_users', onlineUsersList);
    }

    getOnlineStats() {
        let registeredUsers = 0;
        let guests = 0;

        for (const user of this.activeUsers.values()) {
            if (user.isGuest) guests++;
            else registeredUsers++;
        }

        return {
            success: true,
            data: {
                users: registeredUsers,
                guests: guests,
                total: registeredUsers + guests
            }
        };
    }

    cleanupGhostUsers() {
        const now = Date.now();
        let changed = false;

        for (const [identifier, user] of this.activeUsers.entries()) {
            if (now - user.lastActive > 120000) {
                this.activeUsers.delete(identifier);
                for (const socketId of user.sockets) {
                    this.socketToUser.delete(socketId);
                }
                if (!user.isGuest && this.io) {
                    this.io.emit('user_offline', { userId: identifier });
                }
                changed = true;
                console.log(`🧹 Cleaned up inactive user: ${identifier}`);
            }
        }

        if (changed) this.broadcastStats();
    }
}

module.exports = new AnalyticsService();