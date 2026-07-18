const router = require('express').Router();
const reviewUserController = require('./review.controller.user');
const { authenticate } = require('../../middleware/auth.middleware');

// Public: get all reviews
router.get('/', reviewUserController.getAllReviews);

// Public: get stats
router.get('/stats', reviewUserController.getStats);

// Authenticated: get user's review
router.get('/my', authenticate, reviewUserController.getUserReview);

// Authenticated: create review
router.post('/', authenticate, reviewUserController.create);

// Authenticated: update review
router.put('/:id', authenticate, reviewUserController.update);

// Authenticated: delete review
router.delete('/:id', authenticate, reviewUserController.delete);

module.exports = router;
