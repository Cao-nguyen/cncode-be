const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const chatWithAdminController = require('./chatwithadmin.controller');

// Get all chats for admin (sorted by unread/read/empty)
router.get('/chats', authenticate, chatWithAdminController.getAllChatsForAdmin);

// Get chat by ID
router.get('/chats/:chatId', authenticate, chatWithAdminController.getChatById);

// Create new chat
router.post('/chats', authenticate, chatWithAdminController.createChat);

// Send message
router.post('/chats/:chatId/messages', authenticate, chatWithAdminController.sendMessage);

// Mark messages as read
router.put('/chats/:chatId/read', authenticate, chatWithAdminController.markAsRead);

// Delete chat
router.delete('/chats/:chatId', authenticate, chatWithAdminController.deleteChat);

module.exports = router;
