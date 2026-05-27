const express = require('express');
const router = express.Router();
const ratingController = require('./rating.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', ratingController.getRatings);

router.use(authenticate);

router.post('/', ratingController.createRating);
router.delete('/:id', ratingController.deleteRating);
router.put('/:id', ratingController.updateRating);

router.get('/admin/all', authorize('admin'), ratingController.getAllRatingsForAdmin);

module.exports = router;
