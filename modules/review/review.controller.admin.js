const reviewAdminService = require('./review.services.admin');

const reviewAdminController = {
    // Get all reviews with pagination and filtering
    async getAllReviews(req, res) {
        try {
            const { page, limit, status } = req.query;
            const data = await reviewAdminService.getAllReviews({ page, limit, status });
            res.json(data);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get review by ID
    async getReviewById(req, res) {
        try {
            const review = await reviewAdminService.getReviewById(req.params.id);
            if (!review) {
                return res.status(404).json({ message: 'Không tìm thấy đánh giá' });
            }
            res.json(review);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Toggle status
    async toggleStatus(req, res) {
        try {
            const review = await reviewAdminService.toggleStatus(req.params.id);
            res.json(review);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Delete review (admin force delete)
    async deleteReview(req, res) {
        try {
            const review = await reviewAdminService.deleteReview(req.params.id);
            res.json({ message: 'Đã xoá đánh giá', review });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get global stats
    async getGlobalStats(req, res) {
        try {
            const stats = await reviewAdminService.getGlobalStats();
            res.json(stats);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
};

module.exports = reviewAdminController;
