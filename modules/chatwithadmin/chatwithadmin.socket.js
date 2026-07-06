const { ChatWithAdmin } = require('./chatwithadmin.model');

// Track online users
const onlineUsers = new Map(); // userId -> { socketId, role, lastSeen }

const setupChatWithAdminSocket = (io) => {
    // Namespace cho chat with admin
    const chatNamespace = io.of('/chatwithadmin');

    chatNamespace.use(async (socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        if (!token) return next(new Error('Authentication required'));

        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;

            // Fetch user from DB to get role
            const User = require('../user/user.model');
            const user = await User.findById(decoded.userId).select('role').lean();
            socket.userRole = user?.role || decoded.role || 'user';

            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    chatNamespace.on('connection', (socket) => {
        console.log(`[ChatWithAdmin] ${socket.userRole === 'admin' ? 'Admin' : 'User'} connected:`, socket.userId);

        // Track user as online
        onlineUsers.set(socket.userId, {
            socketId: socket.id,
            role: socket.userRole,
            lastSeen: new Date()
        });

        // Broadcast user online status
        chatNamespace.emit('user_status', {
            userId: socket.userId,
            status: 'online',
            role: socket.userRole
        });

        // Admin join admin room
        if (socket.userRole === 'admin') {
            socket.join('admin_room');
            console.log(`[ChatWithAdmin] Admin ${socket.userId} joined admin_room`);
        }

        // User join room của chính mình
        socket.join(`user_${socket.userId}`);

        // Send list of online users
        socket.emit('online_users', Array.from(onlineUsers.entries()).map(([userId, data]) => ({
            userId,
            status: 'online',
            role: data.role
        })));

        // Handle: user gửi tin nhắn
        socket.on('user_send_message', async (data, callback) => {
            try {
                const { content } = data;
                if (!content) {
                    return callback?.({ success: false, message: 'Nội dung tin nhắn trống' });
                }

                let chat = await ChatWithAdmin.findOne({ userId: socket.userId });
                if (!chat) {
                    chat = await ChatWithAdmin.create({ userId: socket.userId });
                }

                // Add message
                chat.messages.push({
                    senderId: socket.userId,
                    senderRole: 'user',
                    content,
                    read: false,
                    timestamp: new Date()
                });
                chat.lastMessageAt = new Date();
                chat.unreadCount = (chat.unreadCount || 0) + 1;
                await chat.save();

                const newMessage = chat.messages[chat.messages.length - 1];

                // Gửi lại cho user
                chatNamespace.to(`user_${socket.userId}`).emit('new_message', {
                    ...newMessage,
                    conversationId: chat._id,
                    conversationUserId: socket.userId,
                    unreadCount: chat.unreadCount
                });

                // Gửi cho admin
                chatNamespace.to('admin_room').emit('new_message', {
                    ...newMessage,
                    conversationId: chat._id,
                    conversationUserId: socket.userId,
                    unreadCount: chat.unreadCount
                });

                callback?.({ success: true, data: chat });
            } catch (error) {
                console.error('[ChatWithAdmin] user_send_message error:', error);
                callback?.({ success: false, message: error.message });
            }
        });

        // Handle: admin gửi tin nhắn
        socket.on('admin_send_message', async (data, callback) => {
            try {
                if (socket.userRole !== 'admin') {
                    return callback?.({ success: false, message: 'Only admin can use this' });
                }

                const { chatId, content } = data;
                if (!chatId || !content) {
                    return callback?.({ success: false, message: 'Thiếu thông tin' });
                }

                const chat = await ChatWithAdmin.findById(chatId);
                if (!chat) {
                    return callback?.({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
                }

                // Add message
                chat.messages.push({
                    senderId: socket.userId,
                    senderRole: 'admin',
                    content,
                    read: false,
                    timestamp: new Date()
                });
                chat.lastMessageAt = new Date();
                chat.userUnreadCount = (chat.userUnreadCount || 0) + 1;
                chat.adminId = socket.userId;
                await chat.save();

                const newMessage = chat.messages[chat.messages.length - 1];

                // Gửi cho user
                chatNamespace.to(`user_${chat.userId}`).emit('new_message', {
                    ...newMessage,
                    conversationId: chat._id,
                    conversationUserId: chat.userId
                });

                // Gửi cho admin room
                chatNamespace.to('admin_room').emit('new_message', {
                    ...newMessage,
                    conversationId: chat._id,
                    conversationUserId: chat.userId
                });

                callback?.({ success: true, data: chat });
            } catch (error) {
                console.error('[ChatWithAdmin] admin_send_message error:', error);
                callback?.({ success: false, message: error.message });
            }
        });

        // Handle: mark as read
        socket.on('mark_read', async (data, callback) => {
            try {
                const { chatId } = data;
                const mongoose = require('mongoose');

                if (socket.userRole === 'admin') {
                    let convId = chatId;
                    let chat = null;
                    
                    // Nếu chatId thực chất là userId, tìm chat tương ứng
                    if (mongoose.Types.ObjectId.isValid(chatId)) {
                        chat = await ChatWithAdmin.findOne({
                            $or: [
                                { _id: chatId },
                                { userId: chatId }
                            ]
                        });
                        if (chat) {
                            convId = chat._id;
                        }
                    }

                    if (chat) {
                        // Mark all messages from user as read
                        chat.messages.forEach(msg => {
                            if (msg.senderRole === 'user') {
                                msg.read = true;
                            }
                        });
                        chat.unreadCount = 0;
                        await chat.save();

                        // Thông báo cho admin room
                        chatNamespace.to('admin_room').emit('messages_read', { 
                            conversationId: convId.toString(), 
                            userId: chatId 
                        });
                        // Thông báo cho user biết tin nhắn đã được đọc
                        chatNamespace.to(`user_${chat.userId}`).emit('messages_read', { 
                            conversationId: convId.toString() 
                        });
                    }
                } else {
                    // User marking admin messages as read
                    const chat = await ChatWithAdmin.findOne({ userId: socket.userId });
                    if (chat) {
                        chat.messages.forEach(msg => {
                            if (msg.senderRole === 'admin') {
                                msg.read = true;
                            }
                        });
                        chat.userUnreadCount = 0;
                        await chat.save();

                        // Notify admin that user has read messages
                        chatNamespace.to('admin_room').emit('messages_read', {
                            conversationId: chat._id.toString(),
                            userId: socket.userId
                        });
                    }
                }

                callback?.({ success: true });
            } catch (error) {
                console.error('[ChatWithAdmin] mark_read error:', error);
                callback?.({ success: false, message: error.message });
            }
        });

        // Handle: typing
        socket.on('typing', async (data) => {
            try {
                const { chatId, isTyping } = data;
                const mongoose = require('mongoose');

                if (socket.userRole === 'admin') {
                    chatNamespace.to('admin_room').emit('user_typing', {
                        chatId,
                        userId: socket.userId,
                        isTyping
                    });
                    // Gửi cho user
                    if (chatId && mongoose.Types.ObjectId.isValid(chatId)) {
                        const chat = await ChatWithAdmin.findOne({
                            $or: [
                                { _id: chatId },
                                { userId: chatId }
                            ]
                        });
                        if (chat) {
                            chatNamespace.to(`user_${chat.userId}`).emit('admin_typing', { isTyping });
                        }
                    }
                } else {
                    chatNamespace.to('admin_room').emit('user_typing', {
                        chatId,
                        userId: socket.userId,
                        isTyping
                    });
                }
            } catch (error) {
                console.error('[ChatWithAdmin] typing error:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[ChatWithAdmin] ${socket.userRole} ${socket.userId} disconnected`);

            // Remove from online users
            onlineUsers.delete(socket.userId);

            // Broadcast user offline status
            chatNamespace.emit('user_status', {
                userId: socket.userId,
                status: 'offline',
                role: socket.userRole,
                lastSeen: new Date()
            });
        });
    });
};

module.exports = { setupChatWithAdminSocket, onlineUsers };
