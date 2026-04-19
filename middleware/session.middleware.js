// middleware/session.middleware.js
const crypto = require('crypto');

const generateSessionId = () => {
    return crypto.randomBytes(32).toString('hex');
};

const sessionMiddleware = (req, res, next) => {
    // Lấy sessionId từ cookie hoặc header
    let sessionId = req.cookies?.sessionId || req.headers['x-session-id'];

    if (!sessionId) {
        sessionId = generateSessionId();

        // Set cookie
        res.cookie('sessionId', sessionId, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        });

        console.log(`🆕 Created new session: ${sessionId.substring(0, 8)}...`);
    }

    req.sessionId = sessionId;
    next();
};

module.exports = sessionMiddleware;