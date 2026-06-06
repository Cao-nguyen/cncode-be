const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, adminAuth } = require('../../middleware/auth.middleware');
const {
    getMyConversation,
    getMyMessages,
    sendMessage,
    sendImage,
    markAsRead,
    heartMessage,
    deleteMessage,
    getAllConversations,
    getAllUsers,
    getConversationMessages,
    adminSendMessage,
    adminSendImage,
    adminMarkAsRead,
    adminDeleteMessage,
    getWorkingHours,
    updateWorkingHours,
    checkWorkingHours
} = require('./adminchat.controller');

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// === USER ROUTES ===
router.get('/my-conversation', authenticate, getMyConversation);
router.get('/my-messages', authenticate, getMyMessages);
router.post('/send', authenticate, sendMessage);
router.post('/send-image', authenticate, upload.single('file'), sendImage);
router.patch('/read/:conversationId', authenticate, markAsRead);
router.patch('/heart/:messageId', authenticate, heartMessage);
router.delete('/delete/:messageId', authenticate, deleteMessage);

// === ADMIN ROUTES ===
router.get('/all-users', authenticate, adminAuth, getAllUsers);
router.get('/conversations', authenticate, adminAuth, getAllConversations);
router.get('/conversations/:conversationId/messages', authenticate, adminAuth, getConversationMessages);
router.post('/admin/send', authenticate, adminAuth, adminSendMessage);
router.post('/admin/send-image', authenticate, adminAuth, upload.single('file'), adminSendImage);
router.patch('/admin/read/:conversationId', authenticate, adminAuth, adminMarkAsRead);
router.delete('/admin/delete/:messageId', authenticate, adminAuth, adminDeleteMessage);

// === WORKING HOURS ROUTES (Admin only) ===
router.get('/working-hours', getWorkingHours); // Public - anyone can check
router.get('/check-working-hours', checkWorkingHours); // Public - check if within hours
router.put('/working-hours', authenticate, adminAuth, updateWorkingHours); // Admin only

module.exports = router;
