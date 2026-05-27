
const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(express.json({ limit: '500mb' }));
router.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Proxy endpoint cho video và file từ Telegram (không cần auth) - phải đặt TRƯỚC authenticate
router.get('/proxy/video/:messageId', uploadController.proxyVideo);
router.get('/proxy/file/:messageId', uploadController.proxyFile);

router.use(authenticate);

router.post('/image', uploadController.uploadImage);
router.post('/images', uploadController.uploadMultiple);
router.post('/file', uploadController.uploadFile);
router.post('/video', uploadController.uploadVideo);

module.exports = router;
