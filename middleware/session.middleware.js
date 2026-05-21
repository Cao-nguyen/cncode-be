const socketSessionMiddleware = (socket, next) => {
    const sessionId = socket.handshake.auth?.sessionId || socket.handshake.headers['x-session-id'];
    if (sessionId) {
        socket.sessionId = sessionId;
    }
    next();
};

const sessionMiddleware = (req, res, next) => {
    req.realIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    req.sessionId = req.headers['x-session-id'] || req.cookies['sessionId'];
    next();
};

module.exports = { sessionMiddleware, socketSessionMiddleware };