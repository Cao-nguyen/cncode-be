const reviewUserService = require('./review.services.user');

const reviewUserController = {
    // Get all reviews (public)
    async getAllReviews(req, res) {
        try {
            const { page, limit } = req.query;
            const data = await reviewUserService.getAllReviews({ page, limit });
            res.json(data);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get stats (public)
    async getStats(req, res) {
        try {
            const stats = await reviewUserService.getStats();
            res.json(stats);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get user's review
    async getUserReview(req, res) {
        try {
            const review = await reviewUserService.getUserReview(req.userId);
            res.json(review);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Create review
    async create(req, res) {
        try {
            const review = await reviewUserService.create(req.userId, req.body);
            res.status(201).json(review);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Update review
    async update(req, res) {
        try {
            const review = await reviewUserService.update(req.userId, req.params.id, req.body);
            res.json(review);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Delete review
    async delete(req, res) {
        try {
            const review = await reviewUserService.delete(req.userId, req.params.id);
            res.json({ message: 'Đã xoá đánh giá', review });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
};

module.exports = reviewUserController;
