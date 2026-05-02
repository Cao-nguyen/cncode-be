// modules/shortlink/shortlink.routes.js
const express = require('express');
const shortlinkController = require('./shortlink.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

const router = express.Router();

// Public route - redirect (mount ở root)
router.get('/s/:shortCode', shortlinkController.redirectToOriginal);
router.get('/check-alias/:alias', shortlinkController.checkAlias);

// User routes (cần xác thực) - THÊM prefix /api ở đây
router.post('/api/shorten', authenticate, shortlinkController.createShortLink);
router.get('/api/my-links', authenticate, shortlinkController.getUserLinks);
router.put('/api/:shortCode', authenticate, shortlinkController.updateShortLink);
router.delete('/api/:shortCode', authenticate, shortlinkController.deleteShortLink);

// Admin routes
router.get('/api/admin/all', authenticate, authorize('admin'), shortlinkController.getAllLinks);

module.exports = router;