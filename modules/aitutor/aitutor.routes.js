const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const {
  createChat,
  getChats,
  getChatById,
  sendMessage,
  deleteChat,
  getRateLimit,
  pinChat,
  renameChat,
  getAllChatsAdmin,
  getChatByIdAdmin,
  deleteChatAdmin,
  deleteMessageAdmin
} = require('./aitutor.controller');

// All routes require authentication
router.use(authenticate);

router.post('/chats', createChat);
router.get('/chats', getChats);
router.get('/chats/:chatId', getChatById);
router.post('/message', sendMessage);
router.delete('/chats/:chatId', deleteChat);
router.get('/rate-limit', getRateLimit);
router.put('/chats/:chatId/pin', pinChat);
router.put('/chats/:chatId/rename', renameChat);

// Admin routes
router.get('/admin/chats', getAllChatsAdmin);
router.get('/admin/chats/:chatId', getChatByIdAdmin);
router.delete('/admin/chats/:chatId', deleteChatAdmin);
router.delete('/admin/chats/:chatId/messages/:messageIndex', deleteMessageAdmin);

module.exports = router;
