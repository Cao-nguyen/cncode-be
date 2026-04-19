const crypto = require('crypto');

const generateSessionId = () => {
    return crypto.randomBytes(32).toString('hex');
};

const sessionMiddleware = (req, res, next) => {
    let sessionId = req.cookies?.sessionId;

    if (!sessionId) {
        sessionId = generateSessionId();
        res.cookie('sessionId', sessionId, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });
    }

    req.sessionId = sessionId;
    next();
};

module.exports = sessionMiddleware;