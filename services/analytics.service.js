// services/analytics.service.js
// ✅ FIXED: Tương thích tốt với Cloudflare + VPS NAT

const User = require('../modules/user/user.model');

class AnalyticsService {
    constructor() {
        this.io = null;
        this.activeUsers = new Map(); // identifier -> user data
        this.socketToUser = new Map(); // socketId -> identifier
    }

    init(io) {
        this.io = io;

        io.on('connection', (socket) => {
            console.log(`🔌 New socket connected: ${socket.id}`);

            // ─── Ping / Pong ───────────────────────────────────────────────
            socket.on('ping', () => {
                socket.emit('pong', { timestamp: Date.now() });
            });

            socket.on('heartbeat', () => {
                const identifier = this.socketToUser.get(socket.id);
                if (identifier && this.activeUsers.has(identifier)) {
                    const user = this.activeUsers.get(identifier);
                    user.lastActive = Date.now();
                    user.sockets.add(socket.id);
                }
                socket.emit('pong', { timestamp: Date.now() });
            });

            // ─── Register ──────────────────────────────────────────────────
            socket.on('register', async (data) => {
                console.log(`📝 Registering:`, { socketId: socket.id, ...data });

                const { userId, sessionId } = data;
                const identifier = userId || sessionId;
                if (!identifier) {
                    console.error('❌ No identifier provided');
                    return;
                }

                const isGuest = !userId;
                this.socketToUser.set(socket.id, identifier);

                if (this.activeUsers.has(identifier)) {
                    // Cập nhật user đã có
                    const existing = this.activeUsers.get(identifier);
                    existing.sockets.add(socket.id);
                    existing.lastActive = Date.now();
                    console.log(`✅ Updated existing: ${identifier}`);
                } else {
                    // Tạo user mới
                    let userData = {
                        userId: identifier,
                        isGuest,
                        fullName: 'Khách viếng thăm',
                        avatar: null,
                        role: isGuest ? 'GUEST' : 'USER',
                        sockets: new Set([socket.id]),
                        lastActive: Date.now(),
                        firstSeen: Date.now()
                    };

                    if (!isGuest) {
                        try {
                            const dbUser = await User.findById(userId)
                                .select('fullName avatar role')
                                .lean();
                            if (dbUser) {
                                userData.fullName = dbUser.fullName;
                                userData.avatar = dbUser.avatar;
                                userData.role = dbUser.role || userData.role;
                            }
                        } catch (err) {
                            console.error('Error fetching user from DB:', err);
                        }
                    }

                    this.activeUsers.set(identifier, userData);
                    console.log(`✅ Created new ${isGuest ? 'guest' : 'user'}: ${identifier}`);

                    // Thông báo user mới online cho tất cả (chỉ registered)
                    if (!isGuest) {
                        io.emit('user_online', {
                            userId: userData.userId,
                            fullName: userData.fullName,
                            avatar: userData.avatar,
                        });
                    }
                }

                // Broadcast số lượng mới nhất
                this.broadcastStats();

                // ✅ Gửi danh sách đầy đủ RIÊNG cho socket vừa đăng ký
                // (thay vì broadcast cho tất cả)
                socket.emit('online_users', this.getOnlineUsersList());
            });

            // ─── Client chủ động xin danh sách ────────────────────────────
            // ✅ FIX CHÍNH: Cho phép client request lại sau khi reconnect
            socket.on('request_online_users', () => {
                const list = this.getOnlineUsersList();
                socket.emit('online_users', list);
                console.log(`📋 Sent online list to ${socket.id}: ${list.length} users`);
            });

            // ─── User activity ─────────────────────────────────────────────
            socket.on('user_activity', () => {
                const identifier = this.socketToUser.get(socket.id);
                if (identifier && this.activeUsers.has(identifier)) {
                    this.activeUsers.get(identifier).lastActive = Date.now();
                }
            });

            // ─── Join / Leave post room ────────────────────────────────────
            socket.on('join_post_room', ({ postSlug }) => {
                if (postSlug) {
                    socket.join(`post:${postSlug}`);
                    console.log(`📌 ${socket.id} joined post:${postSlug}`);
                }
            });

            socket.on('leave_post_room', ({ postSlug }) => {
                if (postSlug) {
                    socket.leave(`post:${postSlug}`);
                    console.log(`📌 ${socket.id} left post:${postSlug}`);
                }
            });

            // ─── Disconnect ────────────────────────────────────────────────
            socket.on('disconnect', (reason) => {
                console.log(`🔌 Socket disconnected: ${socket.id} — reason: ${reason}`);
                const identifier = this.socketToUser.get(socket.id);

                if (identifier) {
                    const user = this.activeUsers.get(identifier);
                    if (user) {
                        user.sockets.delete(socket.id);

                        if (user.sockets.size === 0) {
                            // Không còn socket nào → user thực sự offline
                            this.activeUsers.delete(identifier);
                            console.log(`🗑️ Removed user: ${identifier}`);

                            if (!user.isGuest) {
                                io.emit('user_offline', { userId: identifier });
                            }
                        }
                    }
                    this.socketToUser.delete(socket.id);
                    this.broadcastStats();
                }
            });

            socket.on('error', (err) => {
                console.error(`⚠️ Socket error [${socket.id}]:`, err.message);
            });
        });

        // ✅ Cleanup mỗi 5 phút (tăng từ 2 phút, tránh Cloudflare timeout xóa nhầm)
        setInterval(() => this.cleanupInactiveUsers(), 5 * 60 * 1000);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    /**
     * Trả về danh sách registered users đang online
     */
    getOnlineUsersList() {
        const list = [];
        for (const user of this.activeUsers.values()) {
            if (!user.isGuest) {
                list.push({
                    userId: user.userId,
                    fullName: user.fullName,
                    avatar: user.avatar,
                    role: user.role,
                });
            }
        }
        return list;
    }

    /**
     * Broadcast số lượng online (users + guests) cho tất cả.
     * ✅ KHÔNG broadcast danh sách nữa — client tự request khi cần.
     */
    broadcastStats() {
        if (!this.io) return;

        let registeredUsers = 0;
        let guests = 0;

        for (const user of this.activeUsers.values()) {
            if (user.isGuest) guests++;
            else registeredUsers++;
        }

        const stats = {
            users: registeredUsers,
            guests,
            total: registeredUsers + guests,
            timestamp: Date.now()
        };

        console.log(`📊 Broadcasting stats: ${registeredUsers} users, ${guests} guests`);
        this.io.emit('online_stats', stats);
    }

    /**
     * REST API fallback
     */
    getOnlineStats() {
        let registeredUsers = 0;
        let guests = 0;
        for (const user of this.activeUsers.values()) {
            if (user.isGuest) guests++;
            else registeredUsers++;
        }
        return {
            success: true,
            data: { users: registeredUsers, guests, total: registeredUsers + guests }
        };
    }

    getActiveConnections() {
        return {
            totalSockets: this.socketToUser.size,
            totalUsers: this.activeUsers.size,
            registeredUsers: Array.from(this.activeUsers.values()).filter(u => !u.isGuest).length,
            guests: Array.from(this.activeUsers.values()).filter(u => u.isGuest).length
        };
    }

    /**
     * ✅ Timeout tăng lên 5 phút để Cloudflare không cắt nhầm connection
     */
    cleanupInactiveUsers() {
        const now = Date.now();
        const INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 phút
        let changed = false;

        for (const [identifier, user] of this.activeUsers.entries()) {
            if (now - user.lastActive > INACTIVE_TIMEOUT) {
                console.log(`🧹 Cleanup inactive: ${identifier}`);
                this.activeUsers.delete(identifier);

                for (const socketId of user.sockets) {
                    this.socketToUser.delete(socketId);
                }

                if (!user.isGuest && this.io) {
                    this.io.emit('user_offline', { userId: identifier });
                }
                changed = true;
            }
        }

        if (changed) {
            this.broadcastStats();
            console.log(`🧹 Cleanup done. Active: ${this.activeUsers.size}`);
        }
    }
}

module.exports = new AnalyticsService();