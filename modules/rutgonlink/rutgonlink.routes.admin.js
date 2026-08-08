const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const {
    getAllShortLinks,
    getShortLinkById,
    createShortLink,
    updateShortLink,
    deleteShortLink,
    getStats
} = require('./rutgonlink.controller.admin');

// Admin routes - Stats
router.get('/stats', authenticate, authorize('admin'), getStats);

// Admin routes - Short Links
router.get('/all', authenticate, authorize('admin'), getAllShortLinks);
router.get('/:id', authenticate, authorize('admin'), getShortLinkById);
router.post('/', authenticate, authorize('admin'), createShortLink);
router.put('/:id', authenticate, authorize('admin'), updateShortLink);
router.delete('/:id', authenticate, authorize('admin'), deleteShortLink);

module.exports = router;
