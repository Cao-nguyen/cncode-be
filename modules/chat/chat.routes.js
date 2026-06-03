const express = require('express');
const router = express.Router();
const chatController = require('./chat.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

// User routes
router.get('/conversations', authenticate, chatController.getConversations);
router.post('/conversations', authenticate, chatController.createConversation);
router.get('/conversations/:id', authenticate, chatController.getConversationById);
router.post('/conversations/:conversationId/pin', authenticate, chatController.togglePinConversation);
router.post('/conversations/:conversationId/read', authenticate, chatController.markConversationAsRead);
router.post('/conversations/:conversationId/clear', authenticate, chatController.clearConversationHistory);
router.post('/conversations/:conversationId/leave', authenticate, chatController.leaveGroup);
router.get('/conversations/:conversationId/messages', authenticate, chatController.getMessages);
router.post('/conversations/:conversationId/messages', authenticate, chatController.sendMessage);
router.delete('/messages/:messageId', authenticate, chatController.deleteMessage);
router.post('/messages/:messageId/vote', authenticate, chatController.voteOnPoll);

// Admin routes
router.get('/admin/conversations', authenticate, requireAdmin, chatController.getAllConversations);
router.delete('/admin/conversations/:id', authenticate, requireAdmin, chatController.deleteConversation);
router.get('/admin/stats', authenticate, requireAdmin, chatController.getChatStats);

module.exports = router;