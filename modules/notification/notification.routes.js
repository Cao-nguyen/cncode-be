// modules/notification/notification.routes.js
const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Tất cả routes đều cần xác thực
router.use(authenticate);

// Route tĩnh (không có tham số) đặt TRƯỚC
router.get('/my', notificationController.getMyNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/mark-all-read', notificationController.markAllAsRead);
router.post('/send-to-users', notificationController.sendToUsers);  // SỬA: GET -> POST

// Route có tham số đặt SAU
router.put('/:notificationId/read', notificationController.markAsRead);
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;