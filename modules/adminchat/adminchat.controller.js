const { AdminChatConversation, AdminChatMessage } = require('./adminchat.model');
const uploadService = require('../../services/upload.service');
const User = require('../user/user.model');
const WorkingHours = require('./workingHours.model');

// Helper to get io instance
function getIO(req) {
    return req.app.get('io');
}

// Helper to emit new message event to user and admin
async function emitNewMessage(io, message, conversation) {
    try {
        // Emit to user room
        io.of('/admin-chat').to(`user_${message.senderId._id || message.senderId}`).emit('new_message', message);

        // Calculate unread count for admin
        const unreadCount = await AdminChatMessage.countDocuments({
            conversationId: conversation._id,
            senderId: { $ne: null },
            isRead: false,
            isDeleted: false
        });

        // Emit to admin room
        io.of('/admin-chat').to('admin_room').emit('new_message', {
            ...message,
            unreadCount,
            conversationUserId: message.senderId._id || message.senderId
        });

        // Also emit notification to all admin sockets on main namespace
        const senderName = message.senderId?.fullName || 'User';
        io.to('admin_room').emit('new_notification', {
            _id: `chat_${message._id}`,
            type: 'admin_chat_message',
            content: `${senderName} đã gửi tin nhắn`,
            senderId: message.senderId,
            createdAt: new Date(),
            read: false
        });
    } catch (err) {
        console.error('[AdminChat] emitNewMessage error:', err);
    }
}

// === USER ROUTES ===

// Lấy hoặc tạo conversation của user hiện tại với admin
const getMyConversation = async (req, res) => {
    try {
        const userId = req.userId;
        let conversation = await AdminChatConversation.findOne({ userId });

        if (!conversation) {
            conversation = await AdminChatConversation.create({ userId });
        }

        // Calculate unread count - messages from admin that user hasn't read
        let unreadCount = 0;
        if (conversation._id) {
            unreadCount = await AdminChatMessage.countDocuments({
                conversationId: conversation._id,
                senderId: { $ne: userId }, // messages from admin, not from user
                isRead: false,
                isDeleted: false
            });
        }

        const conversationWithUnread = conversation.toObject();
        conversationWithUnread.unreadCount = unreadCount;

        res.json({
            success: true,
            data: conversationWithUnread ? [conversationWithUnread] : [],
            total: conversationWithUnread ? 1 : 0,
            totalUnread: unreadCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Lấy tin nhắn của conversation của user
const getMyMessages = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 50 } = req.query;

        const conversation = await AdminChatConversation.findOne({ userId });
        if (!conversation) {
            return res.json({ success: true, data: [], hasMore: false });
        }

        const skip = (Number(page) - 1) * Number(limit);
        const messages = await AdminChatMessage.find({
            conversationId: conversation._id,
            isDeleted: false
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit) + 1)
            .populate('senderId', 'fullName avatar role')
            .lean();

        const hasMore = messages.length > Number(limit);
        if (hasMore) messages.pop();

        res.json({
            success: true,
            data: messages.reverse(), // đảo lại đúng thứ tự thời gian
            hasMore
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Gửi tin nhắn (USER)
const sendMessage = async (req, res) => {
    try {
        const userId = req.userId;
        const { content, type = 'text' } = req.body;

        let conversation = await AdminChatConversation.findOne({ userId });
        if (!conversation) {
            conversation = await AdminChatConversation.create({ userId });
        }

        const message = await AdminChatMessage.create({
            conversationId: conversation._id,
            senderId: userId,
            content: content || '',
            type
        });

        // Update lastMessage
        conversation.lastMessage = {
            content: content || 'Đã gửi ảnh',
            senderId: userId,
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

        // Emit socket events for realtime updates
        const io = getIO(req);
        await emitNewMessage(io, populatedMessage, conversation);

        res.json({ success: true, data: populatedMessage });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Gửi ảnh (USER)
const sendImage = async (req, res) => {
    try {
        const userId = req.userId;
        if (!req.file && !req.files?.length) {
            return res.status(400).json({ success: false, message: 'Không có file' });
        }

        let conversation = await AdminChatConversation.findOne({ userId });
        if (!conversation) {
            conversation = await AdminChatConversation.create({ userId });
        }

        const file = req.files ? req.files[0] : req.file;
        // Convert buffer to base64
        const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        const uploadResult = await uploadService.uploadFromBase64(base64, 'adminchat');

        if (!uploadResult.success) {
            return res.status(500).json({ success: false, message: 'Upload ảnh thất bại', error: uploadResult.error });
        }

        const message = await AdminChatMessage.create({
            conversationId: conversation._id,
            senderId: userId,
            type: 'image',
            attachments: [{
                url: uploadResult.url,
                fileType: file.mimetype,
                name: file.originalname,
                size: file.size
            }]
        });

        // Update lastMessage
        conversation.lastMessage = {
            content: '📷 Hình ảnh',
            senderId: userId,
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

        // Emit socket events for realtime updates
        const io = getIO(req);
        await emitNewMessage(io, populatedMessage, conversation);

        res.json({ success: true, data: populatedMessage });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Đánh dấu đã đọc tất cả tin nhắn (user đã đọc tin nhắn admin)
const markAsRead = async (req, res) => {
    try {
        const userId = req.userId;
        const { conversationId } = req.params;

        const conversation = await AdminChatConversation.findOne({
            _id: conversationId,
            userId
        });

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        await AdminChatMessage.updateMany(
            {
                conversationId: conversation._id,
                senderId: { $ne: userId }, // chỉ đánh dấu tin nhắn của người khác (admin)
                isRead: false
            },
            { isRead: true, readAt: new Date() }
        );

        // Emit to admin that messages were read
        const io = getIO(req);
        io.of('/admin-chat').to('admin_room').emit('messages_read', {
            conversationId: conversation._id,
            userId
        });

        res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Thả tim tin nhắn
const heartMessage = async (req, res) => {
    try {
        const userId = req.userId;
        const { messageId } = req.params;

        const message = await AdminChatMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
        }

        // Chỉ user có thể thả tim tin nhắn của admin, admin có thể thả tim tin nhắn của user
        // toggle heart
        if (message.isHearted) {
            message.isHearted = false;
            message.heartedBy = null;
        } else {
            message.isHearted = true;
            message.heartedBy = userId;
        }
        await message.save();

        res.json({ success: true, data: { isHearted: message.isHearted } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Xóa tin nhắn
const deleteMessage = async (req, res) => {
    try {
        const userId = req.userId;
        const { messageId } = req.params;

        const message = await AdminChatMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
        }

        // Chỉ người gửi mới được xóa
        if (message.senderId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Không có quyền xóa tin nhắn này' });
        }

        message.isDeleted = true;
        await message.save();

        res.json({ success: true, message: 'Đã xóa tin nhắn' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// === ADMIN ROUTES ===

// Lấy tất cả người dùng (có hỗ trợ tìm kiếm)
const getAllUsers = async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;

        let query = {};
        if (search) {
            query = {
                $or: [
                    { fullName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const skip = (Number(page) - 1) * Number(limit);
        const users = await User.find(query)
            .select('fullName email avatar _id')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await User.countDocuments(query);

        res.json({ success: true, data: users, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Lấy tất cả conversation (cho admin)
const getAllConversations = async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const mongoose = require('mongoose');

        const matchStage = { _id: { $ne: new mongoose.Types.ObjectId(req.userId) } };
        if (search) {
            matchStage.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'adminchatconversations',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'conversation'
                }
            },
            {
                $unwind: {
                    path: '$conversation',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    // Add a field to distinguish conversations with messages from those without
                    hasConversation: { $cond: [{ $ifNull: ['$conversation.updatedAt', false] }, 1, 0] }
                }
            },
            {
                $sort: {
                    hasConversation: -1, // Conversations with messages first (1 before 0)
                    'conversation.updatedAt': -1, // Then sort by most recent message
                    'createdAt': -1 // Finally, for users without conversations, sort by registration date
                }
            },
            { $skip: skip },
            { $limit: Number(limit) },
            {
                $project: {
                    _id: '$conversation._id',
                    userId: {
                        _id: '$_id',
                        fullName: '$fullName',
                        email: '$email',
                        avatar: '$avatar',
                        role: '$role'
                    },
                    lastMessage: '$conversation.lastMessage',
                    isActive: '$conversation.isActive',
                    assignedAdmin: '$conversation.assignedAdmin',
                    createdAt: '$conversation.createdAt',
                    updatedAt: '$conversation.updatedAt'
                }
            }
        ];

        const conversations = await User.aggregate(pipeline);

        // Get unread count for each conversation
        const conversationsWithUnread = await Promise.all(
            conversations.map(async (conv) => {
                let unreadCount = 0;
                if (conv._id) {
                    unreadCount = await AdminChatMessage.countDocuments({
                        conversationId: conv._id,
                        senderId: { $ne: req.userId }, // tin nhắn từ user, chưa đọc bởi admin
                        isRead: false,
                        isDeleted: false
                    });
                }
                return { ...conv, unreadCount };
            })
        );

        const total = await User.countDocuments(matchStage);

        const hasMore = skip + conversations.length < total;
        res.json({ success: true, data: conversationsWithUnread, total, page: Number(page), limit: Number(limit), hasMore });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Lấy tin nhắn của một conversation (admin)
const getConversationMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const mongoose = require('mongoose');

        // conversationId có thể là ID của cuộc hội thoại HOẶC ID của User (nếu chưa có hội thoại)
        let conversation = null;
        if (mongoose.Types.ObjectId.isValid(conversationId)) {
            conversation = await AdminChatConversation.findById(conversationId);
            if (!conversation) {
                conversation = await AdminChatConversation.findOne({ userId: conversationId });
            }
        }

        if (!conversation) {
            // Chưa có hội thoại -> trả về mảng rỗng để FE reset khung chat
            return res.json({ success: true, data: [], hasMore: false });
        }

        const skip = (Number(page) - 1) * Number(limit);
        const messages = await AdminChatMessage.find({
            conversationId: conversation._id,
            isDeleted: false
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit) + 1)
            .populate('senderId', 'fullName avatar role')
            .lean();

        const hasMore = messages.length > Number(limit);
        if (hasMore) messages.pop();

        res.json({
            success: true,
            data: messages.reverse(),
            hasMore
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin gửi tin nhắn
const adminSendMessage = async (req, res) => {
    try {
        const adminId = req.userId;
        const { userId, content, type = 'text' } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'Thiếu userId' });
        }

        let conversation = await AdminChatConversation.findOne({ userId });
        if (!conversation) {
            conversation = await AdminChatConversation.create({ userId });
        }

        const message = await AdminChatMessage.create({
            conversationId: conversation._id,
            senderId: adminId,
            content: content || '',
            type
        });

        conversation.lastMessage = {
            content: content || '📷 Hình ảnh',
            senderId: adminId,
            sentAt: new Date()
        };
        await conversation.save();

        // Mark as delivered immediately - server received the message
        message.isDelivered = true;
        message.deliveredAt = new Date();
        await message.save();

        const populatedMessage = await AdminChatMessage.findById(message._id)
            .populate('senderId', 'fullName avatar role')
            .lean();
        populatedMessage.isDelivered = true;
        populatedMessage.deliveredAt = message.deliveredAt;

        // Emit socket events for realtime updates
        const io = getIO(req);
        const adminIo = io.of('/admin-chat');

        // Send to user
        console.log(`[AdminChat] Emitting new_message to user_${userId}`);
        console.log(`[AdminChat] Message data:`, JSON.stringify(populatedMessage, null, 2));
        adminIo.to(`user_${userId}`).emit('new_message', populatedMessage);

        // Send to all admin rooms
        console.log(`[AdminChat] Emitting new_message to admin_room`);
        adminIo.to('admin_room').emit('new_message', {
            ...populatedMessage,
            conversationUserId: userId
        });

        res.json({ success: true, data: populatedMessage });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin gửi ảnh
const adminSendImage = async (req, res) => {
    try {
        const adminId = req.userId;
        const userId = req.body.userId;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'Thiếu userId' });
        }

        if (!req.file && !req.files?.length) {
            return res.status(400).json({ success: false, message: 'Không có file' });
        }

        let conversation = await AdminChatConversation.findOne({ userId });
        if (!conversation) {
            conversation = await AdminChatConversation.create({ userId });
        }

        const file = req.files ? req.files[0] : req.file;
        const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        const uploadResult = await uploadService.uploadFromBase64(base64, 'adminchat');

        if (!uploadResult.success) {
            return res.status(500).json({ success: false, message: 'Upload ảnh thất bại', error: uploadResult.error });
        }

        const message = await AdminChatMessage.create({
            conversationId: conversation._id,
            senderId: adminId,
            type: 'image',
            attachments: [{
                url: uploadResult.url,
                fileType: file.mimetype,
                name: file.originalname,
                size: file.size
            }]
        });

        conversation.lastMessage = {
            content: '📷 Hình ảnh',
            senderId: adminId,
            sentAt: new Date()
        };
        await conversation.save();

        // Mark as delivered immediately
        message.isDelivered = true;
        message.deliveredAt = new Date();
        await message.save();

        const populatedMessage = await AdminChatMessage.findById(message._id)
            .populate('senderId', 'fullName avatar role')
            .lean();
        populatedMessage.isDelivered = true;
        populatedMessage.deliveredAt = message.deliveredAt;

        // Emit socket events for realtime updates
        const io = getIO(req);
        const adminIo = io.of('/admin-chat');

        // Send to user
        adminIo.to(`user_${userId}`).emit('new_message', populatedMessage);

        // Send to all admin rooms
        adminIo.to('admin_room').emit('new_message', {
            ...populatedMessage,
            conversationUserId: userId
        });

        res.json({ success: true, data: populatedMessage });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin mark as read
const adminMarkAsRead = async (req, res) => {
    try {
        const adminId = req.userId;
        const { conversationId } = req.params;
        const mongoose = require('mongoose');

        let conversation = null;
        if (mongoose.Types.ObjectId.isValid(conversationId)) {
            conversation = await AdminChatConversation.findById(conversationId);
            if (!conversation) {
                conversation = await AdminChatConversation.findOne({ userId: conversationId });
            }
        }

        if (!conversation) {
            return res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
        }

        await AdminChatMessage.updateMany(
            {
                conversationId: conversation._id,
                senderId: conversation.userId,
                isRead: false
            },
            { isRead: true, readAt: new Date() }
        );

        // Notify user that messages were read
        const io = getIO(req);
        io.of('/admin-chat').to(`user_${conversation.userId}`).emit('messages_read', {
            conversationId: conversation._id
        });

        res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin delete message
const adminDeleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;

        const message = await AdminChatMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
        }

        message.isDeleted = true;
        await message.save();

        res.json({ success: true, message: 'Đã xóa tin nhắn' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// === WORKING HOURS ===
const getWorkingHours = async (req, res) => {
    try {
        const hours = await WorkingHours.getAllConfig();
        res.json({ success: true, data: hours });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateWorkingHours = async (req, res) => {
    try {
        const { dayOfWeek, isWorkingDay, startTime, endTime } = req.body;

        let hours = await WorkingHours.findOne({ dayOfWeek });
        if (!hours) {
            hours = new WorkingHours({ dayOfWeek });
        }

        if (isWorkingDay !== undefined) hours.isWorkingDay = isWorkingDay;
        if (startTime !== undefined) hours.startTime = startTime;
        if (endTime !== undefined) hours.endTime = endTime;

        await hours.save();
        res.json({ success: true, data: hours });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Check working hours (public)
const checkWorkingHours = async (req, res) => {
    try {
        const isWithinWorkingHours = await WorkingHours.isWithinWorkingHours();
        res.json({ success: true, isWithinWorkingHours });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getMyConversation,
    getMyMessages,
    sendMessage,
    sendImage,
    markAsRead,
    heartMessage,
    deleteMessage,
    getAllUsers,
    getAllConversations,
    getConversationMessages,
    adminSendMessage,
    adminSendImage,
    adminMarkAsRead,
    adminDeleteMessage,
    getWorkingHours,
    updateWorkingHours,
    checkWorkingHours
};