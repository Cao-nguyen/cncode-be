const router = require('express').Router();
const reviewAdminController = require('./review.controller.admin');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

// Get global stats
router.get('/stats', authenticate, requireAdmin, reviewAdminController.getGlobalStats);

// Get all reviews with pagination and filtering
router.get('/', authenticate, requireAdmin, reviewAdminController.getAllReviews);

// Get review by ID
router.get('/:id', authenticate, requireAdmin, reviewAdminController.getReviewById);

// Toggle status
router.patch('/:id/toggle-status', authenticate, requireAdmin, reviewAdminController.toggleStatus);

// Delete review (admin force delete)
router.delete('/:id', authenticate, requireAdmin, reviewAdminController.deleteReview);

module.exports = router;
