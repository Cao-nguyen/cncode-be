const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');
const { uploadLimiter } = require('../../middleware/ratelimit.middleware');
const { heavyQueueMiddleware } = require('../../middleware/queue.middleware');

router.use(express.json({ limit: '500mb' }));
router.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Proxy endpoint for files from Telegram (no auth needed, apply rate limit)
router.get('/proxy/file/:messageId', uploadLimiter, uploadController.proxyFile);

// Upload routes - authenticate first, then apply rate limit (so admin skip works)
router.use(authenticate);
router.use(heavyQueueMiddleware);

// Apply rate limiting after auth for upload endpoints
router.post('/image', uploadLimiter, uploadController.uploadImage);
router.post('/images', uploadLimiter, uploadController.uploadMultiple);
router.post('/file', uploadLimiter, uploadController.uploadFile);

module.exports = router;