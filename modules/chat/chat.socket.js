const { Conversation, Message } = require('./chat.model');

const setupChatSocket = (io) => {
    io.on('connection', (socket) => {
        console.log('User connected to chat:', socket.id);

        // Join user's personal room
        if (socket.userId) {
            socket.join(socket.userId.toString());
            console.log(`User ${socket.userId} joined personal room`);
        }

        // Join conversation room
        socket.on('join_conversation', async (conversationId) => {
            try {
                if (!socket.userId) return;

                // Verify user is participant
                const conversation = await Conversation.findOne({
                    _id: conversationId,
                    'participants.userId': socket.userId
                });

                if (conversation) {
                    socket.join(`conversation_${conversationId}`);
                    console.log(`User ${socket.userId} joined conversation ${conversationId}`);

                    socket.emit('joined_conversation', { conversationId });
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
        socket.on('mark_read', async ({ conversationId }) => {
            try {
                if (!socket.userId) return;

                await Conversation.updateOne(
                    { _id: conversationId, 'participants.userId': socket.userId },
                    { $set: { 'participants.$.lastReadAt': new Date() } }
                );

                // Notify other participants
                socket.to(`conversation_${conversationId}`).emit('messages_read', {
                    conversationId,
                    userId: socket.userId,
                    readAt: new Date()
                });
            } catch (error) {
                console.error('Mark read error:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected from chat:', socket.id);
        });
    });
};

module.exports = { setupChatSocket };