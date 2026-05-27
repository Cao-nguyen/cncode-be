const User = require('../modules/user/user.model');

class AnalyticsService {
    constructor() {
        this.io = null;
        this.activeUsers = new Map();
        this.socketToUser = new Map();
        this.guestInfo = new Map();
    }

    init(io) {
        this.io = io;

        io.on('connection', (socket) => {
            console.log(`🔌 New socket connected: ${socket.id}`);

            const userAgent = socket.handshake.headers['user-agent'];
            const device = this.parseDevice(userAgent);
            const ip = this.getClientIp(socket);

            socket.device = device;
            socket.clientIp = ip;

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

            socket.on('register', async (data) => {
                const { userId, sessionId } = data;
                const identifier = userId || sessionId;

                if (!identifier) return;

                const isGuest = !userId;
                this.socketToUser.set(socket.id, identifier);

                if (this.activeUsers.has(identifier)) {
                    const existing = this.activeUsers.get(identifier);
                    existing.sockets.add(socket.id);
                    existing.lastActive = Date.now();

                    if (socket.device) existing.device = socket.device;
                    if (socket.clientIp) existing.ip = socket.clientIp;
                } else {
                    let userData = {
                        userId: identifier,
                        isGuest,
                        fullName: isGuest ? 'Khách viếng thăm' : 'Đang tải...',
                        avatar: null,
                        role: isGuest ? 'GUEST' : 'USER',
                        device: socket.device,
                        ip: socket.clientIp,
                        location: null,
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
                            console.error('Error fetching user:', err);
                        }
                    } else {
                        if (socket.clientIp) {
                            this.fetchLocationForGuest(identifier, socket.clientIp);
                        }
                    }

                    this.activeUsers.set(identifier, userData);
                }

                this.broadcastStats();
                socket.emit('online_users', this.getOnlineUsersList());
            });

            socket.on('request_online_users', () => {
                socket.emit('online_users', this.getOnlineUsersList());
            });

            socket.on('disconnect', () => {
                const identifier = this.socketToUser.get(socket.id);
                if (identifier) {
                    const user = this.activeUsers.get(identifier);
                    if (user) {
                        user.sockets.delete(socket.id);
                        if (user.sockets.size === 0) {
                            this.activeUsers.delete(identifier);
                        }
                    }
                    this.socketToUser.delete(socket.id);
                    this.broadcastStats();
                }
            });
        });

        setInterval(() => this.cleanupInactiveUsers(), 5 * 60 * 1000);
    }

    getClientIp(socket) {
        const forwarded = socket.handshake.headers['x-forwarded-for'];
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }
        return socket.handshake.address || 'Unknown';
    }

    async fetchLocationForGuest(identifier, ip) {
        if (!ip || ip === 'Unknown' || ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('::ffff:127.0.0.1')) {
            const user = this.activeUsers.get(identifier);
            if (user) {
                user.location = 'Localhost';
            }
            return;
        }

        try {
            console.log(`Fetching location for IP: ${ip}`);
            const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`);
            const data = await response.json();

            console.log('Location data:', data);

            if (data.status === 'success') {
                const location = [data.city, data.regionName, data.country].filter(Boolean).join(', ');

                const user = this.activeUsers.get(identifier);
                if (user) {
                    user.location = location || 'Không xác định';
                    console.log(`Updated location for ${identifier}: ${user.location}`);
                }
            } else {
                const user = this.activeUsers.get(identifier);
                if (user) {
                    user.location = 'Không xác định';
                }
            }
        } catch (error) {
            console.error('Error fetching location:', error);
            const user = this.activeUsers.get(identifier);
            if (user) {
                user.location = 'Lỗi lấy vị trí';
            }
        }
    }

    parseDevice(userAgent) {
        if (!userAgent) return 'Không xác định';

        const ua = userAgent.toLowerCase();

        if (ua.includes('iphone')) return 'iPhone';
        if (ua.includes('ipad')) return 'iPad';
        if (ua.includes('android')) {
            if (ua.includes('mobile')) return 'Android Phone';
            return 'Android Tablet';
        }

        if (ua.includes('windows')) return 'Windows';
        if (ua.includes('mac')) return 'Mac';
        if (ua.includes('linux')) return 'Linux';

        if (ua.includes('mobile') || ua.includes('phone')) return 'Điện thoại';
        if (ua.includes('tablet')) return 'Máy tính bảng';

        return 'Máy tính';
    }

    getOnlineUsersList() {
        const list = [];
        for (const user of this.activeUsers.values()) {
            if (!user.isGuest) {
                list.push({
                    userId: user.userId,
                    fullName: user.fullName,
                    avatar: user.avatar,
                    role: user.role,
                    device: user.device || 'Không xác định'
                });
            }
        }
        return list;
    }

    getOnlineGuestsList() {
        const list = [];
        for (const user of this.activeUsers.values()) {
            if (user.isGuest) {
                list.push({
                    sessionId: user.userId,
                    device: user.device || 'Không xác định',
                    ip: user.ip || 'Unknown',
                    location: user.location || 'Đang tải...',
                    firstSeen: user.firstSeen,
                    lastActive: user.lastActive
                });
            }
        }
        return list;
    }

    async broadcastStats() {
        if (!this.io) return;

        let registeredUsers = 0;
        let guests = 0;

        for (const user of this.activeUsers.values()) {
            if (user.isGuest) guests++;
            else registeredUsers++;
        }

        const statisticService = require('../modules/statistic/statistic.service');
        const stats = await statisticService.getStats();

        this.io.emit('online_stats', {
            users: registeredUsers,
            guests: guests,
            total: registeredUsers + guests,
            totalVisits: stats.totalVisits,
            todayVisits: stats.todayVisits,
            timestamp: Date.now()
        });
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
            data: { users: registeredUsers, guests, total: registeredUsers + guests }
        };
    }

    cleanupInactiveUsers() {
        const now = Date.now();
        const INACTIVE_TIMEOUT = 5 * 60 * 1000;
        let changed = false;

        for (const [identifier, user] of this.activeUsers.entries()) {
            if (now - user.lastActive > INACTIVE_TIMEOUT) {
                this.activeUsers.delete(identifier);
                for (const socketId of user.sockets) {
                    this.socketToUser.delete(socketId);
                }
                changed = true;
            }
        }

        if (changed) {
            this.broadcastStats();
        }
    }
}

module.exports = new AnalyticsService();