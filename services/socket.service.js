let io = null;

const setIO = (socketIO) => {
    io = socketIO;
    console.log('[Socket Service] Socket.IO instance set');
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call setIO first.');
    }
    return io;
};

const broadcastToAll = (event, data) => {
    if (io) {
        io.emit(event, data);
        console.log(`[Socket Service] Broadcasting ${event} to all connected users`);
    } else {
        console.warn('[Socket Service] Socket.IO not initialized, cannot broadcast');
    }
};

const broadcastToAllExcept = (event, data, excludeUserIds = []) => {
    if (io) {
        const sockets = io.sockets.sockets;
        sockets.forEach((socket) => {
            if (!excludeUserIds.includes(socket.userId)) {
                socket.emit(event, data);
            }
        });
        console.log(`[Socket Service] Broadcasting ${event} to all users except ${excludeUserIds.length} users`);
    }
};

const broadcastToNonAdmins = async (event, data) => {
    if (io) {
        const User = require('../modules/user/user.model');

        const adminUsers = await User.find({ role: 'admin' }, '_id').lean();
        const adminUserIds = adminUsers.map(u => u._id.toString());

        const sockets = io.sockets.sockets;
        let sentCount = 0;
        sockets.forEach((socket) => {
            if (socket.userId && !adminUserIds.includes(socket.userId.toString())) {
                socket.emit(event, data);
                sentCount++;
            }
        });
        console.log(`[Socket Service] Broadcasting ${event} to ${sentCount} non-admin users`);
    } else {
        console.warn('[Socket Service] Socket.IO not initialized, cannot broadcast');
    }
};

const sendToUser = (userId, event, data) => {
    if (io) {
        const sockets = io.sockets.sockets;
        let sentCount = 0;
        sockets.forEach((socket) => {
            if (socket.userId && socket.userId.toString() === userId.toString()) {
                socket.emit(event, data);
                sentCount++;
            }
        });
        console.log(`[Socket Service] Sent ${event} to ${sentCount} socket(s) for user ${userId}`);
    }
};

module.exports = {
    setIO,
    getIO,
    broadcastToAll,
    broadcastToAllExcept,
    broadcastToNonAdmins,
    sendToUser
};
