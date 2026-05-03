const express = require('express');
const router = express.Router();
const ratingController = require('./rating.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// ========== PUBLIC ROUTES ==========
router.get('/', ratingController.getRatings);

// ========== PROTECTED ROUTES (cần đăng nhập) ==========
router.use(authenticate);

// User routes
router.post('/', ratingController.createRating);
router.delete('/:id', ratingController.deleteRating);
router.put('/:id', ratingController.updateRating);

// ========== ADMIN ROUTES ==========
router.get('/admin/all', authorize('admin'), ratingController.getAllRatingsForAdmin);

module.exports = router;