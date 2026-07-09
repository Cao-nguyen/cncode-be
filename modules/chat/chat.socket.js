const { Conversation, Message } = require('./chat.model');

const setupChatSocket = (io) => {
    io.on('connection', (socket) => {
        console.log('🔌 User connected to chat socket:', socket.id, 'userId:', socket.userId);

        // Join user's personal room
        if (socket.userId) {
            socket.join(socket.userId.toString());
            console.log(`✅ User ${socket.userId} joined personal room`);
        } else {
            console.log('⚠️ No userId in socket, cannot join personal room');
        }

        // Join conversation room
        socket.on('join_conversation', async (conversationId) => {
            try {
                if (!socket.userId) return;

                console.log(`🚪 User ${socket.userId} requesting to join conversation ${conversationId}`);

                // Verify user is participant
                const conversation = await Conversation.findOne({
                    _id: conversationId,
                    'participants.userId': socket.userId
                });

                if (conversation) {
                    socket.join(`conversation_${conversationId}`);
                    console.log(`✅ User ${socket.userId} joined conversation room ${conversationId}`);
                    console.log(`📍 Socket rooms:`, socket.rooms);

                    socket.emit('joined_conversation', { conversationId });
                } else {
                    console.log(`❌ User ${socket.userId} not authorized for conversation ${conversationId}`);
                }
            } catch (error) {
                console.error('Join conversation error:', error);
                socket.emit('error', { message: 'Không thể tham gia cuộc trò chuyện' });
            }
        });

        // Leave conversation room
        socket.on('leave_conversation', (conversationId) => {
            socket.leave(`conversation_${conversationId}`);
            console.log(`User ${socket.userId} left conversation ${conversationId}`);
        });

        // Typing indicator
        socket.on('typing_start', async ({ conversationId }) => {
            try {
                if (!socket.userId) return;

                // Verify user is participant
                const conversation = await Conversation.findOne({
                    _id: conversationId,
                    'participants.userId': socket.userId
                });

                if (conversation) {
                    socket.to(`conversation_${conversationId}`).emit('user_typing', {
                        conversationId,
                        userId: socket.userId
                    });
                }
            } catch (error) {
                console.error('Typing start error:', error);
            }
        });

        socket.on('typing_stop', async ({ conversationId }) => {
            try {
                if (!socket.userId) return;

                socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
                    conversationId,
                    userId: socket.userId
                });
            } catch (error) {
                console.error('Typing stop error:', error);
            }
        });

        // Mark messages as read
        socket.on('mark_read', async ({ conversationId }, callback) => {
            try {
                if (!socket.userId) return;

                // Update conversation's lastReadAt
                await Conversation.updateOne(
                    { _id: conversationId, 'participants.userId': socket.userId },
                    { $set: { 'participants.$.lastReadAt': new Date() } }
                );

                // Update all unread messages in this conversation
                await Message.updateMany(
                    {
                        conversationId,
                        senderId: { $ne: socket.userId },
                        'readBy.userId': { $ne: socket.userId }
                    },
                    {
                        $push: {
                            readBy: {
                                userId: socket.userId,
                                readAt: new Date()
                            }
                        }
                    }
                );

                // Notify other participants
                socket.to(`conversation_${conversationId}`).emit('messages_read', {
                    conversationId,
                    userId: socket.userId,
                    readAt: new Date()
                });

                // Send confirmation to sender
                if (callback) {
                    callback({ success: true });
                }
            } catch (error) {
                console.error('Mark read error:', error);
                if (callback) {
                    callback({ success: false, message: error.message });
                }
            }
        });

        // Heart/like message
        socket.on('heart_message', async ({ messageId }, callback) => {
            try {
                if (!socket.userId) return;

                const message = await Message.findById(messageId)
                    .populate('heartedBy', 'fullName avatar');
                if (!message) {
                    callback({ success: false, message: 'Message not found' });
                    return;
                }

                const heartedBy = message.heartedBy || [];
                const userIdStr = socket.userId.toString();
                const isHearted = heartedBy.some(u => u._id && u._id.toString() === userIdStr);

                if (isHearted) {
                    // Remove heart
                    message.heartedBy = heartedBy.filter(u => u._id && u._id.toString() !== userIdStr);
                } else {
                    // Add heart
                    message.heartedBy = [...heartedBy, socket.userId];
                }

                await message.save();

                // Re-populate to get user objects
                await message.populate('heartedBy', 'fullName avatar');

                // Emit to conversation room
                const conversationId = message.conversationId;
                io.to(`conversation_${conversationId}`).emit('message_hearted', {
                    messageId,
                    isHearted: !isHearted,
                    heartedBy: message.heartedBy
                });

                callback({ success: true, data: { isHearted: !isHearted, heartedBy: message.heartedBy } });
            } catch (error) {
                console.error('Heart message error:', error);
                callback({ success: false, message: error.message });
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected from chat:', socket.id);
        });
    });
};

module.exports = { setupChatSocket };