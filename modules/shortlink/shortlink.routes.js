// modules/shortlink/shortlink.routes.js
const express = require('express');
const shortlinkController = require('./shortlink.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

const router = express.Router();

// Public routes
router.get('/s/:shortCode', shortlinkController.redirectToOriginal);
router.get('/check-alias/:alias', shortlinkController.checkAlias);

// User routes
router.post('/api/shorten', authenticate, shortlinkController.createShortLink);
router.get('/api/my-links', authenticate, shortlinkController.getUserLinks);
router.put('/api/:shortCode', authenticate, shortlinkController.updateShortLink);
router.delete('/api/:shortCode', authenticate, shortlinkController.deleteShortLink);

// Admin routes
router.get('/api/admin/all', authenticate, authorize('admin'), shortlinkController.getAllLinks);
router.get('/api/admin/stats', authenticate, authorize('admin'), shortlinkController.getStats);
router.delete('/api/admin/:shortCode', authenticate, authorize('admin'), shortlinkController.deleteShortLink);

module.exports = router;