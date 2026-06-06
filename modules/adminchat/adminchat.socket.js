const { AdminChatConversation, AdminChatMessage } = require('./adminchat.model');

// Track online users
const onlineUsers = new Map(); // userId -> { socketId, role, lastSeen }

const setupAdminChatSocket = (io) => {
    // Admin namespace: chỉ admin mới join được
    const adminNamespace = io.of('/admin-chat');

    adminNamespace.use(async (socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        if (!token) return next(new Error('Authentication required'));

        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;

            // Fetch user from DB to ensure we get the latest role (useful for older tokens without role)
            const User = require('../user/user.model');
            const user = await User.findById(decoded.userId).select('role').lean();
            socket.userRole = user?.role || decoded.role || 'user';

            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    adminNamespace.on('connection', (socket) => {
        console.log(`[AdminChat] ${socket.userRole === 'admin' ? 'Admin' : 'User'} connected:`, socket.userId);

        // Track user as online
        onlineUsers.set(socket.userId, {
            socketId: socket.id,
            role: socket.userRole,
            lastSeen: new Date()
        });

        // Broadcast user online status
        adminNamespace.emit('user_status', {
            userId: socket.userId,
            status: 'online',
            role: socket.userRole
        });

        // Admin join room admin (để nhận tất cả tin nhắn)
        if (socket.userRole === 'admin') {
            socket.join('admin_room');
            console.log(`[AdminChat] Admin ${socket.userId} joined admin_room`);
        }

        // User join room của chính mình
        socket.join(`user_${socket.userId}`);

        // Send list of online users to newly connected user
        socket.emit('online_users', Array.from(onlineUsers.entries()).map(([userId, data]) => ({
            userId,
            status: 'online',
            role: data.role
        })));

        // Handle: user gửi tin nhắn
        socket.on('user_send_message', async (data, callback) => {
            try {
                const { content, type = 'text' } = data;
                if (!content && type === 'text') {
                    return callback?.({ success: false, message: 'Nội dung tin nhắn trống' });
                }

                let conversation = await AdminChatConversation.findOne({ userId: socket.userId });
                if (!conversation) {
                    conversation = await AdminChatConversation.create({ userId: socket.userId });
                }

                const message = await AdminChatMessage.create({
                    conversationId: conversation._id,
                    senderId: socket.userId,
                    content: content || '',
                    type
                });

                conversation.lastMessage = {
                    content: content || '📷 Hình ảnh',
                    senderId: socket.userId,
                    sentAt: new Date()
                };
                await conversation.save();

                // Mark as delivered immediately - server đã nhận được tin nhắn
                message.isDelivered = true;
                message.deliveredAt = new Date();
                await message.save();

                const populatedMessage = await AdminChatMessage.findById(message._id)
                    .populate('senderId', 'fullName avatar role')
                    .lean();
                populatedMessage.isDelivered = true;
                populatedMessage.deliveredAt = message.deliveredAt;

                // Gửi lại cho user
                adminNamespace.to(`user_${socket.userId}`).emit('new_message', populatedMessage);

                // Gửi cho admin
                const unreadCount = await AdminChatMessage.countDocuments({
                    conversationId: conversation._id,
                    senderId: { $ne: null },
                    isRead: false,
                    isDeleted: false
                });
                adminNamespace.to('admin_room').emit('new_message', {
                    ...populatedMessage,
                    unreadCount,
                    conversationUserId: socket.userId
                });

                // Send notification to all admins via main socket namespace
                const mainIo = io; // io is passed to this function
                const adminSockets = Array.from(onlineUsers.entries())
                    .filter(([_, data]) => data.role === 'admin')
                    .map(([userId]) => userId);

                for (const adminId of adminSockets) {
                    mainIo.to(`user_${adminId}`).emit('new_notification', {
                        _id: `chat_${message._id}`,
                        type: 'admin_chat_message',
                        content: `${populatedMessage.senderId.fullName} đã gửi tin nhắn`,
                        senderId: populatedMessage.senderId,
                        createdAt: new Date(),
                        read: false
                    });
                }

                callback?.({ success: true, data: populatedMessage });
            } catch (error) {
                console.error('[AdminChat] user_send_message error:', error);
                callback?.({ success: false, message: error.message });
            }
        });

        // Handle: admin gửi tin nhắn
        socket.on('admin_send_message', async (data, callback) => {
            try {
                if (socket.userRole !== 'admin') {
                    return callback?.({ success: false, message: 'Only admin can use this' });
                }

                const { conversationId, content } = data;
                if (!conversationId || !content) {
                    return callback?.({ success: false, message: 'Thiếu thông tin' });
                }

                const conversation = await AdminChatConversation.findById(conversationId);
                if (!conversation) {
                    return callback?.({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
                }

                const message = await AdminChatMessage.create({
                    conversationId,
                    senderId: socket.userId,
                    content,
                    type: 'text'
                });

                conversation.lastMessage = {
                    content,
                    senderId: socket.userId,
                    sentAt: new Date()
                };
                if (!conversation.assignedAdmin) {
                    conversation.assignedAdmin = socket.userId;
                }
                await conversation.save();

                const populatedMessage = await AdminChatMessage.findById(message._id)
                    .populate('senderId', 'fullName avatar role')
                    .lean();

                // Mark as delivered if user is online
                if (onlineUsers.has(conversation.userId.toString())) {
                    message.isDelivered = true;
                    message.deliveredAt = new Date();
                    await message.save();
                    populatedMessage.isDelivered = true;
                    populatedMessage.deliveredAt = message.deliveredAt;
                }

                // Gửi cho user
                adminNamespace.to(`user_${conversation.userId}`).emit('new_message', populatedMessage);
                // Gửi cho admin room
                adminNamespace.to('admin_room').emit('new_message', populatedMessage);

                callback?.({ success: true, data: populatedMessage });
            } catch (error) {
                console.error('[AdminChat] admin_send_message error:', error);
                callback?.({ success: false, message: error.message });
            }
        });

        // Handle: mark as read
        socket.on('mark_read', async (data, callback) => {
            try {
                const { conversationId } = data;
                const mongoose = require('mongoose');

                if (socket.userRole === 'admin') {
                    let convId = conversationId;
                    let conversation = null;
                    // Nếu conversationId thực chất là userId, tìm conversation tương ứng
                    if (mongoose.Types.ObjectId.isValid(conversationId)) {
                        conversation = await AdminChatConversation.findOne({
                            $or: [
                                { _id: conversationId },
                                { userId: conversationId }
                            ]
                        });
                        if (conversation) {
                            convId = conversation._id;
                        }
                    }

                    await AdminChatMessage.updateMany(
                        { conversationId: convId, senderId: { $ne: socket.userId }, isRead: false },
                        { isRead: true, readAt: new Date() }
                    );
                    // Thông báo cho admin room
                    adminNamespace.to('admin_room').emit('messages_read', { conversationId: convId.toString(), userId: conversationId, readBy: socket.userId });
                    // Thông báo cho user biết tin nhắn đã được đọc
                    if (conversation) {
                        adminNamespace.to(`user_${conversation.userId}`).emit('messages_read', { conversationId: convId.toString() });
                    }
                } else {
                    const conversation = await AdminChatConversation.findOne({ userId: socket.userId });
                    if (conversation) {
                        await AdminChatMessage.updateMany(
                            { conversationId: conversation._id, senderId: { $ne: socket.userId }, isRead: false },
                            { isRead: true, readAt: new Date() }
                        );
                    }
                }

                callback?.({ success: true });
            } catch (error) {
                console.error('[AdminChat] mark_read error:', error);
                callback?.({ success: false, message: error.message });
            }
        });

        // Handle: typing
        socket.on('typing', async (data) => {
            try {
                const { conversationId, isTyping } = data;
                const mongoose = require('mongoose');

                if (socket.userRole === 'admin') {
                    adminNamespace.to('admin_room').emit('user_typing', {
                        conversationId,
                        userId: socket.userId,
                        isTyping
                    });
                    // Gửi cho user
                    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
                        const conversation = await AdminChatConversation.findOne({
                            $or: [
                                { _id: conversationId },
                                { userId: conversationId }
                            ]
                        });
                        if (conversation) {
                            adminNamespace.to(`user_${conversation.userId}`).emit('admin_typing', { isTyping });
                        }
                    }
                } else {
                    adminNamespace.to('admin_room').emit('user_typing', {
                        conversationId,
                        userId: socket.userId,
                        isTyping
                    });
                }
            } catch (error) {
                console.error('[AdminChat] typing error:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[AdminChat] ${socket.userRole} ${socket.userId} disconnected`);

            // Remove from online users
            onlineUsers.delete(socket.userId);

            // Broadcast user offline status
            adminNamespace.emit('user_status', {
                userId: socket.userId,
                status: 'offline',
                role: socket.userRole,
                lastSeen: new Date()
            });
        });
    });
};

module.exports = { setupAdminChatSocket, onlineUsers };
