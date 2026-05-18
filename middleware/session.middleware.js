const crypto = require('crypto');

const generateSessionId = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Lưu trữ session data (tạm thời dùng Map, production nên dùng Redis)
const sessionStore = new Map();

const sessionMiddleware = (req, res, next) => {
    let sessionId = req.cookies?.sessionId;
    let isNewSession = false;

    if (!sessionId) {
        sessionId = generateSessionId();
        isNewSession = true;

        // Chỉ gọi res.cookie nếu res tồn tại (Express request)
        if (res && typeof res.cookie === 'function') {
            res.cookie('sessionId', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
                sameSite: 'lax'
            });
        }
    }

    // Tạo hoặc lấy session data
    if (!sessionStore.has(sessionId)) {
        sessionStore.set(sessionId, {
            id: sessionId,
            createdAt: new Date(),
            lastAccess: new Date(),
            userId: null,
            data: {}
        });
    }

    const session = sessionStore.get(sessionId);
    session.lastAccess = new Date();

    req.sessionId = sessionId;
    req.session = session;

    next();
};

// Middleware đặc biệt cho Socket.IO (không có res)
const socketSessionMiddleware = (socket, next) => {
    const req = socket.request;
    // Tạo mock res để tránh lỗi
    const mockRes = {
        cookie: () => { }
    };
    sessionMiddleware(req, mockRes, next);
};

// Hàm lấy session (dùng ở nơi khác)
const getSession = (sessionId) => {
    return sessionStore.get(sessionId);
};

// Hàm cập nhật session
const updateSession = (sessionId, data) => {
    if (sessionStore.has(sessionId)) {
        const session = sessionStore.get(sessionId);
        Object.assign(session.data, data);
        sessionStore.set(sessionId, session);
        return true;
    }
    return false;
};

module.exports = sessionMiddleware;
module.exports.socketSessionMiddleware = socketSessionMiddleware;
module.exports.getSession = getSession;
module.exports.updateSession = updateSession;