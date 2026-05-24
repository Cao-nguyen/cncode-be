// modules/upload/upload.routes.js
const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Tăng limit cho route upload
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));

router.use(authenticate);

// ✅ CHỈ GIỮ 2 ROUTE NÀY, BỎ /url
router.post('/image', uploadController.uploadImage);
router.post('/images', uploadController.uploadMultiple);

module.exports = router;