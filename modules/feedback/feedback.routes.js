const express = require('express');
const router = express.Router();
const feedbackController = require('./feedback.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// ========== PUBLIC ROUTES ==========
router.get('/', feedbackController.getFeedbacks);

// ========== PROTECTED ROUTES ==========
router.use(authenticate);

// User routes
router.post('/', feedbackController.createFeedback);
router.get('/my', feedbackController.getUserFeedbacks);
router.post('/:id/like', feedbackController.likeFeedback);
router.delete('/:id', feedbackController.deleteFeedback);
router.get('/:id', feedbackController.getFeedbackById);
router.put('/:id', feedbackController.updateFeedback);

// ========== ADMIN ROUTES ==========
router.get('/admin/all', authorize('admin'), feedbackController.getAllFeedbacksForAdmin);
router.put('/admin/:id/status', authorize('admin'), feedbackController.updateFeedbackStatus);

module.exports = router;