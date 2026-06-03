const { Conversation, Message } = require('./chat.model');
const User = require('../user/user.model');
const { isValidObjectId } = require('mongoose');

// Lấy danh sách conversations của user
const getConversations = async (req, res) => {
    try {
        const userId = req.userId;
        const { type, search, page = 1, limit = 20 } = req.query;

        const query = {
            'participants.userId': userId,
            isActive: true,
            $or: [
                { hiddenBy: { $exists: false } },
                { 'hiddenBy.userId': { $ne: userId } }
            ]
        };

        if (type) query.type = type;

        const conversations = await Conversation.find(query)
            .populate('participants.userId', 'fullName avatar email role')
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        // Manually populate lastMessage.senderId since it's a nested field
        for (const conv of conversations) {
            if (conv.lastMessage?.senderId) {
                const sender = await require('../user/user.model').findById(conv.lastMessage.senderId).select('fullName avatar');
                if (sender) {
                    conv.lastMessage.senderId = sender;
                }
            }
        }

        // Filter by search if provided
        let filteredConversations = conversations;
        if (search) {
            filteredConversations = conversations.filter(conv => {
                if (conv.type === 'group') {
                    return conv.name?.toLowerCase().includes(search.toLowerCase());
                } else {
                    const otherUser = conv.participants.find(p => p.userId._id.toString() !== userId);
                    return otherUser?.userId.fullName?.toLowerCase().includes(search.toLowerCase());
                }
            });
        }

        // Calculate unread count for each conversation
        const conversationsWithUnread = filteredConversations.map(conv => {
            const participant = conv.participants.find(p => p.userId._id.toString() === userId);
            const unreadCount = conv.lastMessage && participant.lastReadAt < conv.lastMessage.sentAt ? 1 : 0;

            return {
                ...conv.toObject(),
                unreadCount
            };
        });

        const total = await Conversation.countDocuments(query);

        res.json({
            success: true,
            data: conversationsWithUnread,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Tạo conversation mới (private hoặc group)
const createConversation = async (req, res) => {
    try {
        const userId = req.userId;
        const { type, name, description, participantIds, avatar } = req.body;

        if (!type || !['private', 'group'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Type không hợp lệ' });
        }

        if (type === 'private') {
            if (!participantIds || participantIds.length !== 1) {
                return res.status(400).json({ success: false, message: 'Chat 1-1 cần đúng 1 người nhận' });
            }

            // Check if conversation already exists
            const existingConv = await Conversation.findOne({
                type: 'private',
                'participants.userId': { $all: [userId, participantIds[0]] }
            });

            if (existingConv) {
                return res.json({ success: true, data: existingConv });
            }
        }

        if (type === 'group' && (!name || !name.trim())) {
            return res.status(400).json({ success: false, message: 'Tên nhóm không được để trống' });
        }

        // Validate participant IDs
        const validParticipantIds = participantIds?.filter(id => isValidObjectId(id)) || [];

        // Create participants array
        const participants = [
            { userId, role: type === 'group' ? 'admin' : 'member' },
            ...validParticipantIds.map(id => ({ userId: id, role: 'member' }))
        ];

        const conversation = new Conversation({
            type,
            name: type === 'group' ? name : undefined,
            description: type === 'group' ? description : undefined,
            avatar: type === 'group' ? avatar : undefined,
            participants,
            createdBy: userId
        });

        await conversation.save();

        const populatedConv = await Conversation.findById(conversation._id)
            .populate('participants.userId', 'fullName avatar email role');

        // Emit socket event to all participants
        const io = req.app.get('io');
        if (io) {
            participants.forEach(p => {
                io.to(p.userId.toString()).emit('new_conversation', populatedConv);
            });
        }

        res.status(201).json({ success: true, data: populatedConv });
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Lấy chi tiết conversation
const getConversationById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        const conversation = await Conversation.findOne({
            _id: id,
            'participants.userId': userId
        }).populate('participants.userId', 'fullName avatar email role');

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        res.json({ success: true, data: conversation });
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Lấy messages của conversation
const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.userId;
        const { page = 1, limit = 50 } = req.query;

        if (!isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        // Check if user is participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': userId
        });

        if (!conversation) {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
        }

        // Get user's clearHistoryAt timestamp
        const participant = conversation.participants.find(p => p.userId.toString() === userId);
        const clearHistoryAt = participant?.clearHistoryAt;

        // Build query to filter messages
        const messageQuery = {
            conversationId,
            isDeleted: false
        };

        // Only show messages after clearHistoryAt
        if (clearHistoryAt) {
            messageQuery.createdAt = { $gt: clearHistoryAt };
        }

        const messages = await Message.find(messageQuery)
            .populate('senderId', 'fullName avatar role')
            .populate('replyTo')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Message.countDocuments({ conversationId, isDeleted: false });

        // Update lastReadAt
        await Conversation.updateOne(
            { _id: conversationId, 'participants.userId': userId },
            { $set: { 'participants.$.lastReadAt': new Date() } }
        );

        res.json({
            success: true,
            data: messages.reverse(),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Gửi message
const sendMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.userId;
        const { content, type = 'text', attachments, replyTo, reminder } = req.body;

        if (!isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        if (!content || (typeof content === 'string' && !content.trim())) {
            return res.status(400).json({ success: false, message: 'Nội dung không được để trống' });
        }

        // Validate reminder if type is reminder
        if (type === 'reminder') {
            if (!reminder || !reminder.title || !reminder.scheduledTime) {
                return res.status(400).json({ success: false, message: 'Reminder cần có title và scheduledTime' });
            }
            const scheduledTime = new Date(reminder.scheduledTime);
            if (scheduledTime <= new Date()) {
                return res.status(400).json({ success: false, message: 'Thời gian nhắc phải ở tương lai' });
            }
        }

        // Check if user is participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': userId
        });

        if (!conversation) {
            return res.status(403).json({ success: false, message: 'Không có quyền gửi tin nhắn' });
        }

        const messageContent = typeof content === 'string' ? content.trim() : content;

        const message = new Message({
            conversationId,
            senderId: userId,
            content: messageContent,
            type,
            attachments,
            replyTo: replyTo && isValidObjectId(replyTo) ? replyTo : null,
            reminder: type === 'reminder' ? {
                title: reminder.title,
                scheduledTime: new Date(reminder.scheduledTime),
                isTriggered: false
            } : undefined
        });

        await message.save();

        // Update conversation's lastMessage
        const lastMessageContent = type === 'poll' ? 'Bình chọn' :
            type === 'image' ? 'Hình ảnh' :
                type === 'sticker' ? 'Sticker' :
                    type === 'reminder' ? '⏰ Nhắc hẹn' :
                        (typeof content === 'string' ? content.trim() : content);

        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: {
                content: lastMessageContent,
                senderId: userId,
                sentAt: message.createdAt
            },
            updatedAt: new Date()
        });

        const populatedMessage = await Message.findById(message._id)
            .populate('senderId', 'fullName avatar role')
            .populate('replyTo');

        // Emit socket event to all participants
        const io = req.app.get('io');
        if (io) {
            conversation.participants.forEach(p => {
                io.to(p.userId.toString()).emit('new_message', {
                    conversationId,
                    message: populatedMessage
                });
            });
        }

        res.status(201).json({ success: true, data: populatedMessage });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Xóa message
const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.userId;

        if (!isValidObjectId(messageId)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
        }

        if (message.senderId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Không có quyền xóa tin nhắn này' });
        }

        message.isDeleted = true;
        message.deletedAt = new Date();
        await message.save();

        // Emit socket event
        const conversation = await Conversation.findById(message.conversationId);
        const io = req.app.get('io');
        if (io && conversation) {
            conversation.participants.forEach(p => {
                io.to(p.userId.toString()).emit('message_deleted', {
                    conversationId: message.conversationId,
                    messageId
                });
            });
        }

        res.json({ success: true, message: 'Đã xóa tin nhắn' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Lấy tất cả conversations
const getAllConversations = async (req, res) => {
    try {
        const { type, search, page = 1, limit = 20 } = req.query;

        const query = { isActive: true };
        if (type) query.type = type;

        const conversations = await Conversation.find(query)
            .populate('participants.userId', 'fullName avatar email role')
            .populate('createdBy', 'fullName avatar email')
            .populate('lastMessage.senderId', 'fullName avatar')
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Conversation.countDocuments(query);

        res.json({
            success: true,
            data: conversations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get all conversations error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Xóa conversation (hard delete)
const deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        const conversation = await Conversation.findById(id);

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        // Xóa vĩnh viễn tất cả messages của conversation này
        await Message.deleteMany({ conversationId: id });

        // Xóa vĩnh viễn conversation
        await Conversation.findByIdAndDelete(id);

        res.json({ success: true, message: 'Đã xóa vĩnh viễn cuộc trò chuyện và tất cả tin nhắn' });
    } catch (error) {
        console.error('Delete conversation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Vote cho poll
const voteOnPoll = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.userId;
        const { optionIndices } = req.body;

        if (!isValidObjectId(messageId)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        if (!Array.isArray(optionIndices) || optionIndices.length === 0) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 lựa chọn' });
        }

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
        }

        if (message.type !== 'poll') {
            return res.status(400).json({ success: false, message: 'Tin nhắn này không phải là bình chọn' });
        }

        // Check if user is participant
        const conversation = await Conversation.findOne({
            _id: message.conversationId,
            'participants.userId': userId
        });

        if (!conversation) {
            return res.status(403).json({ success: false, message: 'Không có quyền vote' });
        }

        // Parse poll data
        let pollData;
        try {
            pollData = JSON.parse(message.content);
        } catch (error) {
            return res.status(400).json({ success: false, message: 'Dữ liệu poll không hợp lệ' });
        }

        // If user already voted, remove their previous votes
        if (pollData.voters && pollData.voters.includes(userId)) {
            // Remove user from all options' votes
            pollData.options.forEach(option => {
                if (option.votes) {
                    option.votes = option.votes.filter(id => id !== userId);
                }
            });
            // Remove user from voters list
            pollData.voters = pollData.voters.filter(id => id !== userId);
            // Decrease total votes
            pollData.totalVotes = Math.max(0, (pollData.totalVotes || 0) - 1);
        }

        // Validate option indices
        const invalidIndices = optionIndices.filter(idx => idx < 0 || idx >= pollData.options.length);
        if (invalidIndices.length > 0) {
            return res.status(400).json({ success: false, message: 'Lựa chọn không hợp lệ' });
        }

        // Check if multiple votes allowed
        if (!pollData.allowMultiple && optionIndices.length > 1) {
            return res.status(400).json({ success: false, message: 'Chỉ được chọn 1 đáp án' });
        }

        // Add user vote
        if (!pollData.voters) pollData.voters = [];
        pollData.voters.push(userId);

        // Add user to selected options' votes
        optionIndices.forEach(idx => {
            if (!pollData.options[idx].votes) pollData.options[idx].votes = [];
            pollData.options[idx].votes.push(userId);
        });

        // Update total votes
        pollData.totalVotes = (pollData.totalVotes || 0) + 1;

        // Save updated poll data
        message.content = JSON.stringify(pollData);
        await message.save();

        const populatedMessage = await Message.findById(message._id)
            .populate('senderId', 'fullName avatar role');

        // Emit socket event to all participants
        const io = req.app.get('io');
        if (io) {
            conversation.participants.forEach(p => {
                io.to(p.userId.toString()).emit('poll_updated', {
                    conversationId: message.conversationId,
                    message: populatedMessage
                });
            });
        }

        res.json({ success: true, data: populatedMessage });
    } catch (error) {
        console.error('Vote on poll error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Toggle pin conversation
const togglePinConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.userId;

        if (!isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': userId,
            isActive: true
        });

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        const isPinned = conversation.pinnedBy.some(p => p.userId.toString() === userId);

        if (isPinned) {
            // Unpin
            conversation.pinnedBy = conversation.pinnedBy.filter(p => p.userId.toString() !== userId);
        } else {
            // Check limit: max 3 pinned conversations per user
            const pinnedCount = await Conversation.countDocuments({
                'participants.userId': userId,
                'pinnedBy.userId': userId,
                isActive: true
            });

            if (pinnedCount >= 3) {
                return res.status(400).json({
                    success: false,
                    message: 'Bạn chỉ có thể ghim tối đa 3 cuộc trò chuyện'
                });
            }

            // Pin
            conversation.pinnedBy.push({
                userId: userId,
                pinnedAt: new Date()
            });
        }

        await conversation.save();

        res.json({
            success: true,
            data: {
                conversationId,
                isPinned: !isPinned
            },
            message: isPinned ? 'Đã bỏ ghim' : 'Đã ghim cuộc trò chuyện'
        });
    } catch (error) {
        console.error('Toggle pin conversation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Đánh dấu đã đọc conversation
const markConversationAsRead = async (req, res) => {
    try {
        const userId = req.userId;
        const { conversationId } = req.params;

        if (!isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        // Check if user is participant
        const participant = conversation.participants.find(p => p.userId.toString() === userId);
        if (!participant) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập' });
        }

        // Update lastReadAt to current time
        participant.lastReadAt = new Date();
        await conversation.save();

        res.json({
            success: true,
            message: 'Đã đánh dấu là đã đọc'
        });
    } catch (error) {
        console.error('Mark conversation as read error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Xoá tin nhắn trong hội thoại (clear history cho user)
const clearConversationHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const { conversationId } = req.params;

        if (!isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        // Check if user is participant
        const participant = conversation.participants.find(p => p.userId.toString() === userId);
        if (!participant) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập' });
        }

        // Update participant's lastReadAt to now (future messages will still show)
        // Store clearHistoryAt timestamp so we can filter messages before this time
        participant.clearHistoryAt = new Date();
        await conversation.save();

        res.json({
            success: true,
            message: 'Đã xoá tin nhắn cũ'
        });
    } catch (error) {
        console.error('Clear conversation history error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Rời nhóm
const leaveGroup = async (req, res) => {
    try {
        const userId = req.userId;
        const { conversationId } = req.params;

        if (!isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        if (conversation.type !== 'group') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể rời nhóm' });
        }

        // Check if user is participant
        const participantIndex = conversation.participants.findIndex(p => p.userId.toString() === userId);
        if (participantIndex === -1) {
            return res.status(403).json({ success: false, message: 'Bạn không phải thành viên nhóm' });
        }

        // Remove user from participants
        conversation.participants.splice(participantIndex, 1);

        // If no participants left, mark conversation as inactive
        if (conversation.participants.length === 0) {
            conversation.isActive = false;
        }

        await conversation.save();

        // Send system message
        const systemMessage = new Message({
            conversationId: conversation._id,
            senderId: userId,
            content: 'đã rời nhóm',
            type: 'system'
        });
        await systemMessage.save();

        // Emit socket event to remaining participants
        const io = req.app.get('io');
        if (io) {
            conversation.participants.forEach(p => {
                io.to(p.userId.toString()).emit('user_left_group', {
                    conversationId: conversation._id,
                    userId: userId
                });
            });
        }

        res.json({
            success: true,
            message: 'Đã rời nhóm'
        });
    } catch (error) {
        console.error('Leave group error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Thống kê
const getChatStats = async (req, res) => {
    try {
        const [totalConversations, totalMessages, activeConversations, groupConversations] = await Promise.all([
            Conversation.countDocuments({ isActive: true }),
            Message.countDocuments({ isDeleted: false }),
            Conversation.countDocuments({
                isActive: true,
                updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }),
            Conversation.countDocuments({ type: 'group', isActive: true })
        ]);

        res.json({
            success: true,
            data: {
                totalConversations,
                totalMessages,
                activeConversations,
                groupConversations,
                privateConversations: totalConversations - groupConversations
            }
        });
    } catch (error) {
        console.error('Get chat stats error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getConversations,
    createConversation,
    getConversationById,
    getMessages,
    sendMessage,
    deleteMessage,
    voteOnPoll,
    togglePinConversation,
    markConversationAsRead,
    clearConversationHistory,
    leaveGroup,
    getAllConversations,
    deleteConversation,
    getChatStats
};
