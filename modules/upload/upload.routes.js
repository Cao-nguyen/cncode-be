
const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { uploadLimiter } = require('../../middleware/ratelimit.middleware');
const { heavyQueueMiddleware } = require('../../middleware/queue.middleware');

router.use(express.json({ limit: '500mb' }));
router.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Apply upload rate limiting and heavy queue for upload routes
router.use(uploadLimiter);
router.use(heavyQueueMiddleware);

// Proxy endpoint cho video và file từ Telegram (không cần auth) - phải đặt TRƯỚC authenticate
router.get('/proxy/video/:messageId', uploadController.proxyVideo);
router.get('/proxy/file/:messageId', uploadController.proxyFile);

router.use(authenticate);

router.post('/image', uploadController.uploadImage);
router.post('/images', uploadController.uploadMultiple);
router.post('/file', uploadController.uploadFile);
router.post('/video', uploadController.uploadVideo);

module.exports = router;
