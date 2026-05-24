// routes/feedback.routes.js (cập nhật)
const express = require('express');
const router = express.Router();
const feedbackController = require('./feedback.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// ========== PUBLIC ROUTES ==========
router.get('/', feedbackController.getFeedbacks);
router.get('/:id', feedbackController.getFeedbackById);

// ========== PROTECTED ROUTES ==========
router.use(authenticate);

// User routes
router.post('/', feedbackController.createFeedback);
router.get('/my', feedbackController.getUserFeedbacks);
router.post('/:id/react', feedbackController.reactFeedback);
router.delete('/:id', feedbackController.deleteFeedback);
router.put('/:id', feedbackController.updateFeedback);

// ========== ADMIN ROUTES ==========
router.get('/admin/all', authorize('admin'), feedbackController.getAllFeedbacksForAdmin);
router.get('/admin/stats', authorize('admin'), feedbackController.getStats);
router.put('/admin/:id/status', authorize('admin'), feedbackController.updateFeedbackStatus);
router.post('/admin/:id/pin', authorize('admin'), feedbackController.togglePinFeedback);
router.post('/admin/:id/lock', authorize('admin'), feedbackController.toggleLockFeedback);

module.exports = router;