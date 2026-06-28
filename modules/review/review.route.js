const router = require('express').Router();
const reviewService = require('./review.service');
const { authenticate } = require('../../middleware/auth.middleware');

// Public: get reviews + stats for a target
router.get('/:targetType/:targetId', async (req, res) => {
    try {
        const { page, limit } = req.query;
        const data = await reviewService.getByTarget(req.params.targetType, req.params.targetId, { page, limit });
        res.json(data);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Public: get stats for a target
router.get('/:targetType/:targetId/stats', async (req, res) => {
    try {
        const stats = await reviewService.getStats(req.params.targetType, req.params.targetId);
        res.json(stats);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ===== AUTHENTICATED =====
// Create review
router.post('/', authenticate, async (req, res) => {
    try {
        const review = await reviewService.create(req.userId, req.body);
        res.status(201).json(review);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update review
router.put('/:id', authenticate, async (req, res) => {
    try {
        const review = await reviewService.update(req.userId, req.params.id, req.body);
        res.json(review);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete review
router.delete('/:id', authenticate, async (req, res) => {
    try {
        await reviewService.delete(req.userId, req.params.id);
        res.json({ message: 'Đã xoá đánh giá' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get user's review for a specific target
router.get('/my/:targetType/:targetId', authenticate, async (req, res) => {
    try {
        const review = await reviewService.getUserReview(req.userId, req.params.targetType, req.params.targetId);
        res.json(review);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;