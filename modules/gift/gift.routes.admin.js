const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const {
    getAllGifts,
    createGift,
    updateGift,
    deleteGift,
    getStats,
    getRevenueChart,
    getTopGifts,
    getCategoryChart,
} = require('./gift.controller.admin');

router.get('/stats', authenticate, authorize('admin'), getStats);
router.get('/revenue-chart', authenticate, authorize('admin'), getRevenueChart);
router.get('/top-gifts', authenticate, authorize('admin'), getTopGifts);
router.get('/category-chart', authenticate, authorize('admin'), getCategoryChart);
router.get('/all', authenticate, authorize('admin'), getAllGifts);
router.post('/', authenticate, authorize('admin'), createGift);
router.put('/:id', authenticate, authorize('admin'), updateGift);
router.delete('/:id', authenticate, authorize('admin'), deleteGift);

module.exports = router;
