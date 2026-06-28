const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const {
    createRequest,
    getPublicRequests,
    getMyRequests,
    getAllRequests,
    getRequestById,
    updateRequestStatus,
    deleteRequest,
    getStats,
} = require('./cross-promotion.controller');

// Admin routes (mounted at /api/cross-promotion, so these become /api/cross-promotion/admin/...)
router.get('/admin/stats', authenticate, authorize('admin'), getStats);
router.get('/admin', authenticate, authorize('admin'), getAllRequests);
router.get('/admin/:id', authenticate, authorize('admin'), getRequestById);
router.put('/admin/:id/status', authenticate, authorize('admin'), updateRequestStatus);
router.delete('/admin/:id', authenticate, authorize('admin'), deleteRequest);

// User routes (mounted at /api/cross-promotion)
router.post('/', authenticate, createRequest);
router.get('/', authenticate, getMyRequests);

// Public routes
router.get('/public', getPublicRequests);

module.exports = router;