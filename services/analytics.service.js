// services/analytics.service.js
const User = require('../modules/user/user.model');

class AnalyticsService {
    constructor() {
        this.io = null;
        this.onlineGuests = new Map();
        this.onlineUsers = new Map();
        this.socketToUser = new Map();
        this.cleanupInterval = null;
    }

    /**
     * Khởi tạo service với socket.io instance
     */
    init(io) {
        this.io = io;
        this.setupSocketEvents();
        this.startCleanupInterval();
        console.log('✅ Analytics service initialized');
    }

    /**
     * Thiết lập các event handlers cho socket
     */
    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('🔌 New client connected:', socket.id);

            // Register event
            socket.on('register', (data) => this.handleRegister(socket, data));

            // Post room events
            socket.on('join_post_room', (data) => this.handleJoinPostRoom(socket, data));
            socket.on('leave_post_room', (data) => this.handleLeavePostRoom(socket, data));

            // Ping event
            socket.on('ping', () => this.handlePing(socket));

            // Disconnect event
            socket.on('disconnect', () => this.handleDisconnect(socket));
        });
    }

    /**
     * Xử lý register user/guest
     */
    async handleRegister(socket, data) {
        const userId = data?.userId || null;
        const sessionId = data?.sessionId || null;

        if (userId) {
            // Lấy thông tin user từ database
            try {
                const userInfo = await User.findById(userId).select('fullName avatar');

                socket.join(userId.toString());
                this.onlineGuests.delete(socket.id);
                this.onlineUsers.set(userId, {
                    socketId: socket.id,
                    sessionId,
                    userInfo: {
                        userId,
                        fullName: userInfo?.fullName || 'Người dùng',
                        avatar: userInfo?.avatar || null
                    },
                    connectedAt: new Date()
                });
                this.socketToUser.set(socket.id, userId);
                socket.emit('registered', { success: true });

                // Broadcast user online
                this.broadcastOnlineUsers();
                this.io.emit('user_online', {
                    userId,
                    fullName: userInfo?.fullName || 'Người dùng',
                    avatar: userInfo?.avatar || null
                });

                console.log('📡 User registered:', userId);
            } catch (error) {
                console.error('Error fetching user info:', error);
            }
        } else if (sessionId) {
            this.onlineGuests.set(socket.id, {
                sessionId,
                connectedAt: new Date()
            });
            console.log('📡 Guest registered:', sessionId);
        }

        this.broadcastOnlineStats();
    }

    /**
     * Xử lý join post room
     */
    handleJoinPostRoom(socket, { postSlug }) {
        if (postSlug) {
            socket.join(`post_${postSlug}`);
            socket.emit('joined_post_room', { postSlug, room: `post_${postSlug}` });
        }
    }

    /**
     * Xử lý leave post room
     */
    handleLeavePostRoom(socket, { postSlug }) {
        if (postSlug) {
            socket.leave(`post_${postSlug}`);
            socket.emit('left_post_room', { postSlug, room: `post_${postSlug}` });
        }
    }

    /**
     * Xử lý ping để cập nhật thời gian hoạt động
     */
    handlePing(socket) {
        const userId = this.socketToUser.get(socket.id);
        if (userId) {
            const user = this.onlineUsers.get(userId);
            if (user) user.connectedAt = new Date();
        } else {
            const guest = this.onlineGuests.get(socket.id);
            if (guest) guest.connectedAt = new Date();
        }
    }

    /**
     * Xử lý disconnect
     */
    handleDisconnect(socket) {
        console.log('🔌 Client disconnected:', socket.id);

        const userId = this.socketToUser.get(socket.id);
        if (userId) {
            this.onlineUsers.delete(userId);
            this.socketToUser.delete(socket.id);
            this.broadcastOnlineUsers();
            this.io.emit('user_offline', { userId });
        } else {
            this.onlineGuests.delete(socket.id);
        }

        this.broadcastOnlineStats();
    }

    /**
     * Broadcast danh sách online users
     */
    broadcastOnlineUsers() {
        const onlineUsersList = Array.from(this.onlineUsers.values()).map(u => u.userInfo);
        this.io.emit('online_users', onlineUsersList);
    }

    /**
     * Broadcast thống kê online
     */
    broadcastOnlineStats() {
        this.io.emit('online_stats', {
            total: this.onlineGuests.size + this.onlineUsers.size,
            guests: this.onlineGuests.size,
            users: this.onlineUsers.size,
            userList: Array.from(this.onlineUsers.keys()),
        });
    }

    /**
     * Khởi động interval cleanup (xóa các kết nối timeout)
     */
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            const now = new Date();
            let changed = false;

            // Cleanup guests
            for (const [socketId, data] of this.onlineGuests.entries()) {
                if ((now - data.connectedAt) / 1000 > 15) {
                    this.onlineGuests.delete(socketId);
                    changed = true;
                }
            }

            // Cleanup users
            for (const [userId, data] of this.onlineUsers.entries()) {
                if ((now - data.connectedAt) / 1000 > 15) {
                    this.onlineUsers.delete(userId);
                    this.socketToUser.delete(data.socketId);
                    this.io.emit('user_offline', { userId });
                    changed = true;
                }
            }

            if (changed) {
                this.broadcastOnlineUsers();
                this.broadcastOnlineStats();
            }
        }, 5000);
    }

    /**
     * Dừng cleanup interval
     */
    stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Lấy thống kê online hiện tại
     */
    getOnlineStats() {
        return {
            success: true,
            data: {
                total: this.onlineGuests.size + this.onlineUsers.size,
                guests: this.onlineGuests.size,
                users: this.onlineUsers.size,
                userList: Array.from(this.onlineUsers.keys()),
                onlineUsersList: Array.from(this.onlineUsers.values()).map(u => u.userInfo)
            }
        };
    }

    /**
     * Lấy số lượng online
     */
    getOnlineCounts() {
        return {
            users: this.onlineUsers.size,
            guests: this.onlineGuests.size,
            total: this.onlineGuests.size + this.onlineUsers.size
        };
    }
}

module.exports = new AnalyticsService();