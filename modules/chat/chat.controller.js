const { Conversation, Message } = require('./chat.model');
const User = require('../user/user.model');
const mongoose = require('mongoose');

// Helper để log read count changes (sẽ xóa sau khi debug xong)
function logReadCountChange(action, conversationId, userId, oldValue, newValue, source) {
    console.log(`[READ_COUNT_DEBUG] ${action}:`, {
        conversationId,
        userId,
        oldValue,
        newValue,
        delta: newValue - oldValue,
        source,
        timestamp: new Date().toISOString()
    });
}

// Tạo conversation mới hoặc lấy conversation hiện có
exports.createOrGetConversation = async (req, res) => {
    try {
        const { participantId } = req.body;
        const currentUserId = req.userId;

        if (!participantId) {
            return res.status(400).json({ message: 'participantId is required' });
        }

        if (participantId === currentUserId) {
            return res.status(400).json({ message: 'Cannot create conversation with yourself' });
        }

        const participant = await User.findById(participantId);
        if (!participant) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Tìm conversation hiện có (private chat giữa 2 người)
        let conversation = await Conversation.findOne({
            type: 'private',
            'participants.userId': { $all: [currentUserId, participantId] }
        })
            .populate('participants.userId', 'fullName avatar email role')
            .populate('lastMessage.senderId', 'fullName avatar');

        if (conversation) {
            return res.json({ success: true, data: conversation });
        }

        // Tạo conversation mới
        conversation = new Conversation({
            type: 'private',
            participants: [
                { userId: currentUserId, role: 'admin' },
                { userId: participantId, role: 'member' }
            ],
            createdBy: currentUserId
        });

        await conversation.save();
        await conversation.populate('participants.userId', 'fullName avatar email role');

        return res.status(201).json({ success: true, data: conversation });
    } catch (error) {
        console.error('Error in createOrGetConversation:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Lấy danh sách conversations
exports.getConversations = async (req, res) => {
    try {
        const currentUserId = req.userId;

        const conversations = await Conversation.find({
            'participants.userId': currentUserId,
            isActive: true
        })
            .populate('participants.userId', 'fullName avatar email role')
            .populate('lastMessage.senderId', 'fullName avatar')
            .sort({ updatedAt: -1 });

        // Calculate unread count for each conversation
        const conversationsWithUnread = conversations.map(conv => {
            const participant = conv.participants.find(p => p.userId._id.toString() === currentUserId);
            
            const unreadCount = conv.lastMessage &&
                conv.lastMessage.senderId &&
                conv.lastMessage.senderId._id.toString() !== currentUserId &&
                participant.lastReadAt < conv.lastMessage.sentAt ? 1 : 0;

            return {
                ...conv.toObject(),
                unreadCount
            };
        });

        return res.json({ success: true, data: conversationsWithUnread });
    } catch (error) {
        console.error('Error in getConversations:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Lấy messages của một conversation
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.userId;
        const { page = 1, limit = 50 } = req.query;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': currentUserId
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Get messages from Message collection
        const skip = (page - 1) * limit;
        const messages = await Message.find({
            conversationId,
            isDeleted: false
        })
            .populate('senderId', 'fullName avatar role')
            .populate('replyTo')
            .populate('readBy.userId', 'fullName avatar')
            .populate('heartedBy', 'fullName avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Message.countDocuments({
            conversationId,
            isDeleted: false
        });

        // Reverse to show oldest to newest
        const messagesReversed = messages.reverse();

        // Update lastReadAt
        await Conversation.updateOne(
            { _id: conversationId, 'participants.userId': currentUserId },
            { $set: { 'participants.$.lastReadAt': new Date() } }
        );

        return res.json({
            success: true,
            data: messagesReversed,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                hasMore: total > page * limit
            }
        });
    } catch (error) {
        console.error('Error in getMessages:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Gửi message mới
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, content, type = 'text', attachments, replyTo } = req.body;
        const senderId = req.userId;

        if (!content || (typeof content === 'string' && !content.trim())) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': senderId
        });

        if (!conversation) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const messageContent = typeof content === 'string' ? content.trim() : content;

        const message = new Message({
            conversationId,
            senderId,
            content: messageContent,
            type,
            attachments,
            replyTo: replyTo && mongoose.isValidObjectId(replyTo) ? replyTo : null
        });

        await message.save();

        // Update conversation's lastMessage
        const lastMessageContent = type === 'poll' ? 'Bình chọn' :
            type === 'image' ? 'Hình ảnh' :
                type === 'sticker' ? 'Sticker' :
                    type === 'reminder' ? '⏰ Nhắc hẹn' :
                        (typeof content === 'string' ? content.trim() : content);

        // Update conversation's lastMessage and sender's lastReadAt
        await Conversation.updateOne(
            { _id: conversationId, 'participants.userId': senderId },
            {
                $set: {
                    lastMessage: {
                        content: lastMessageContent,
                        senderId: senderId,
                        sentAt: message.createdAt
                    },
                    updatedAt: new Date(),
                    'participants.$.lastReadAt': new Date()
                }
            }
        );

        const populatedMessage = await Message.findById(message._id)
            .populate('senderId', 'fullName avatar role')
            .populate('replyTo')
            .populate('readBy.userId', 'fullName avatar')
            .populate('heartedBy', 'fullName avatar');

        // Emit socket event to all participants
        const io = req.app.get('io');
        if (io) {
            conversation.participants.forEach(participant => {
                const participantUserId = participant.userId.toString();
                const isSender = participantUserId === senderId;
                
                // Calculate unread count for this participant
                const unreadCount = isSender ? 0 : 
                    (conversation.lastMessage &&
                     conversation.lastMessage.senderId &&
                     conversation.lastMessage.senderId.toString() !== participantUserId &&
                     participant.lastReadAt < conversation.lastMessage.sentAt ? 1 : 0);
                
                const payload = {
                    conversationId,
                    message: populatedMessage,
                    unreadCount
                };
                
                // Emit to conversation room
                io.to(`conversation_${conversationId}`).emit('new_message', payload);
                
                // Also emit to personal room
                if (!isSender) {
                    io.to(participantUserId).emit('new_message', payload);
                }
            });
        }

        return res.status(201).json({ success: true, data: populatedMessage });
    } catch (error) {
        console.error('Error in sendMessage:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Mark conversation as read
exports.markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.userId;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': currentUserId
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Update lastReadAt
        await Conversation.updateOne(
            { _id: conversationId, 'participants.userId': currentUserId },
            { $set: { 'participants.$.lastReadAt': new Date() } }
        );

        return res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
        console.error('Error in markAsRead:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete conversation
exports.deleteConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.userId;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': currentUserId
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Delete all messages in this conversation
        await Message.deleteMany({ conversationId });

        // Delete conversation
        await Conversation.findByIdAndDelete(conversationId);

        return res.json({ success: true, message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Error in deleteConversation:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Search users to start conversation
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        const currentUserId = req.userId;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({ message: 'Search query must be at least 2 characters' });
        }

        const users = await User.find({
            _id: { $ne: currentUserId },
            $or: [
                { fullName: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        })
            .select('fullName avatar email role')
            .limit(10);

        return res.json({ success: true, data: users });
    } catch (error) {
        console.error('Error in searchUsers:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get conversation by ID
exports.getConversationById = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.userId;

        const conversation = await Conversation.findOne({
            _id: id,
            'participants.userId': currentUserId
        }).populate('participants.userId', 'fullName avatar email role');

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        return res.json({ success: true, data: conversation });
    } catch (error) {
        console.error('Error in getConversationById:', error);
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// Toggle pin conversation
exports.togglePinConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.userId;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': currentUserId
        });

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        const isPinned = conversation.pinnedBy.some(p => p.userId.toString() === currentUserId);

        if (isPinned) {
            conversation.pinnedBy = conversation.pinnedBy.filter(p => p.userId.toString() !== currentUserId);
        } else {
            conversation.pinnedBy.push({ userId: currentUserId, pinnedAt: new Date() });
        }

        await conversation.save();

        return res.json({
            success: true,
            data: { conversationId, isPinned: !isPinned },
            message: isPinned ? 'Đã bỏ ghim' : 'Đã ghim cuộc trò chuyện'
        });
    } catch (error) {
        console.error('Error in togglePinConversation:', error);
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// Toggle mute conversation
exports.toggleMuteConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.userId;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': currentUserId
        });

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        const isMuted = conversation.mutedBy.some(m => m.userId.toString() === currentUserId);

        if (isMuted) {
            conversation.mutedBy = conversation.mutedBy.filter(m => m.userId.toString() !== currentUserId);
        } else {
            conversation.mutedBy.push({ userId: currentUserId, mutedAt: new Date() });
        }

        await conversation.save();

        return res.json({
            success: true,
            data: { conversationId, isMuted: !isMuted },
            message: isMuted ? 'Đã bật thông báo' : 'Đã tắt thông báo'
        });
    } catch (error) {
        console.error('Error in toggleMuteConversation:', error);
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// Clear conversation history
exports.clearConversationHistory = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.userId;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': currentUserId
        });

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        const participant = conversation.participants.find(p => p.userId.toString() === currentUserId);
        if (participant) {
            participant.clearHistoryAt = new Date();
            await conversation.save();
        }

        return res.json({ success: true, message: 'Đã xoá tin nhắn cũ' });
    } catch (error) {
        console.error('Error in clearConversationHistory:', error);
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// Leave group
exports.leaveGroup = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.userId;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': currentUserId
        });

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        if (conversation.type !== 'group') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể rời nhóm' });
        }

        const participantIndex = conversation.participants.findIndex(p => p.userId.toString() === currentUserId);
        if (participantIndex === -1) {
            return res.status(403).json({ success: false, message: 'Bạn không phải thành viên nhóm' });
        }

        conversation.participants.splice(participantIndex, 1);

        if (conversation.participants.length === 0) {
            conversation.isActive = false;
        }

        await conversation.save();

        // Send system message
        const systemMessage = new Message({
            conversationId: conversation._id,
            senderId: currentUserId,
            content: 'đã rời nhóm',
            type: 'system'
        });
        await systemMessage.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            conversation.participants.forEach(p => {
                io.to(p.userId.toString()).emit('user_left_group', {
                    conversationId: conversation._id,
                    userId: currentUserId
                });
            });
        }

        return res.json({ success: true, message: 'Đã rời nhóm' });
    } catch (error) {
        console.error('Error in leaveGroup:', error);
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// Delete message
exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const currentUserId = req.userId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
        }

        if (message.senderId.toString() !== currentUserId) {
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

        return res.json({ success: true, message: 'Đã xóa tin nhắn' });
    } catch (error) {
        console.error('Error in deleteMessage:', error);
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// Vote on poll
exports.voteOnPoll = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { optionIndices } = req.body;
        const currentUserId = req.userId;

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

        const conversation = await Conversation.findOne({
            _id: message.conversationId,
            'participants.userId': currentUserId
        });

        if (!conversation) {
            return res.status(403).json({ success: false, message: 'Không có quyền vote' });
        }

        let pollData;
        try {
            pollData = JSON.parse(message.content);
        } catch (error) {
            return res.status(400).json({ success: false, message: 'Dữ liệu poll không hợp lệ' });
        }

        // If user already voted, remove their previous votes
        if (pollData.voters && pollData.voters.includes(currentUserId)) {
            pollData.options.forEach(option => {
                if (option.votes) {
                    option.votes = option.votes.filter(id => id !== currentUserId);
                }
            });
            pollData.voters = pollData.voters.filter(id => id !== currentUserId);
            pollData.totalVotes = Math.max(0, (pollData.totalVotes || 0) - 1);
        }

        const invalidIndices = optionIndices.filter(idx => idx < 0 || idx >= pollData.options.length);
        if (invalidIndices.length > 0) {
            return res.status(400).json({ success: false, message: 'Lựa chọn không hợp lệ' });
        }

        if (!pollData.allowMultiple && optionIndices.length > 1) {
            return res.status(400).json({ success: false, message: 'Chỉ được chọn 1 đáp án' });
        }

        if (!pollData.voters) pollData.voters = [];
        pollData.voters.push(currentUserId);

        optionIndices.forEach(idx => {
            if (!pollData.options[idx].votes) pollData.options[idx].votes = [];
            pollData.options[idx].votes.push(currentUserId);
        });

        pollData.totalVotes = (pollData.totalVotes || 0) + 1;

        message.content = JSON.stringify(pollData);
        await message.save();

        const populatedMessage = await Message.findById(message._id)
            .populate('senderId', 'fullName avatar role');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            conversation.participants.forEach(p => {
                io.to(p.userId.toString()).emit('poll_updated', {
                    conversationId: message.conversationId,
                    message: populatedMessage
                });
            });
        }

        return res.json({ success: true, data: populatedMessage });
    } catch (error) {
        console.error('Error in voteOnPoll:', error);
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// Heart message (thả tim)
exports.heartMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const currentUserId = req.userId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
        }

        const isHearted = message.heartedBy && message.heartedBy.some(id => id.toString() === currentUserId);

        if (isHearted) {
            message.heartedBy = message.heartedBy.filter(id => id.toString() !== currentUserId);
        } else {
            if (!message.heartedBy) message.heartedBy = [];
            message.heartedBy.push(currentUserId);
        }

        await message.save();

        const populatedMessage = await Message.findById(message._id)
            .populate('heartedBy', 'fullName avatar');

        // Emit socket event
        const conversation = await Conversation.findById(message.conversationId);
        const io = req.app.get('io');
        if (io && conversation) {
            conversation.participants.forEach(p => {
                io.to(p.userId.toString()).emit('message_hearted', {
                    messageId: message._id,
                    isHearted: !isHearted,
                    heartedBy: populatedMessage.heartedBy
                });
            });
        }

        return res.json({
            success: true,
            data: {
                messageId: message._id,
                isHearted: !isHearted,
                heartedBy: populatedMessage.heartedBy
            }
        });
    } catch (error) {
        console.error('Error in heartMessage:', error);
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// Admin: Get all conversations with pagination
exports.getAllConversations = async (req, res) => {
    try {
        const { page = 1, limit = 20, type } = req.query;
        const skip = (page - 1) * limit;

        const query = {};
        if (type) {
            query.type = type;
        }

        const [conversations, total] = await Promise.all([
            Conversation.find(query)
                .populate('participants', 'fullName avatar email role')
                .populate('createdBy', 'fullName avatar email')
                .populate('lastMessage')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Conversation.countDocuments(query)
        ]);

        return res.json({
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
        console.error('Error in getAllConversations:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Admin: Get chat statistics
exports.getChatStats = async (req, res) => {
    try {
        const [totalConversations, totalMessages, groupConversations, privateConversations] = await Promise.all([
            Conversation.countDocuments(),
            Message.countDocuments({ isDeleted: false }),
            Conversation.countDocuments({ type: 'group' }),
            Conversation.countDocuments({ type: 'private' })
        ]);

        const stats = {
            totalConversations,
            totalMessages,
            groupConversations,
            privateConversations,
            activeUsers: 0 // Can be enhanced with actual active user tracking
        };

        return res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error in getChatStats:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
