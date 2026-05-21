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
                        } catch (e) { }
                    }
                    this.activeUsers.set(identifier, userData);
                }

                // QUAN TRỌNG: Gửi ngay dữ liệu cho chính socket vừa đăng ký
                this.sendIndividualStats(socket);
                // Sau đó mới broadcast cho những người khác
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
                if (identifier) {
                    const userData = this.activeUsers.get(identifier);
                    if (userData) {
                        userData.sockets.delete(socket.id);
                        if (userData.sockets.size === 0) {
                            // Delay xóa để tránh F5 bị mất số lượng
                            setTimeout(() => {
                                if (userData.sockets && userData.sockets.size === 0) {
                                    this.activeUsers.delete(identifier);
                                    this.broadcastStats();
                                }
                            }, 3000);
                        }
                    }
                    this.socketToUser.delete(socket.id);
                }
            });
        });

        setInterval(() => this.cleanup(), 60000);
    }

    // Hàm gửi riêng cho 1 người
    sendIndividualStats(socket) {
        let guests = 0;
        const onlineUsersList = [];
        this.activeUsers.forEach((user) => {
            if (user.isGuest) guests++;
            else onlineUsersList.push({
                userId: user.userId,
                fullName: user.fullName,
                avatar: user.avatar,
                role: user.role,
                device: user.device
            });
        });
        socket.emit('online_stats', { users: onlineUsersList.length, guests });
        socket.emit('online_users_list', onlineUsersList);
    }

    broadcastStats() {
        if (!this.io) return;
        let guests = 0;
        const onlineUsersList = [];
        this.activeUsers.forEach((user) => {
            if (user.isGuest) guests++;
            else onlineUsersList.push({
                userId: user.userId,
                fullName: user.fullName,
                avatar: user.avatar,
                role: user.role,
                device: user.device
            });
        });
        this.io.emit('online_stats', { users: onlineUsersList.length, guests });
        this.io.emit('online_users_list', onlineUsersList);
    }

    cleanup() {
        const now = Date.now();
        this.activeUsers.forEach((user, key) => {
            if (now - user.lastActive > 180000) this.activeUsers.delete(key);
        });
        this.broadcastStats();
    }

    getOnlineStats() {
        let u = 0, g = 0;
        this.activeUsers.forEach(user => user.isGuest ? g++ : u++);
        return { success: true, data: { users: u, guests: g } };
    }
}

module.exports = new AnalyticsService();