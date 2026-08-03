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
  renameChat
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

module.exports = router;
