const Review = require('./review.model');

class ReviewAdminService {
    // Get all reviews with pagination and filtering
    async getAllReviews({ page = 1, limit = 10, status } = {}) {
        const filter = {};
        if (status) filter.status = status;

        const skip = (page - 1) * limit;

        const [reviews, total, stats] = await Promise.all([
            Review.find(filter)
                .populate('userId', 'fullName avatar email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Review.countDocuments(filter),
            Review.getStats()
        ]);

        return {
            reviews,
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
            stats
        };
    }

    // Get review by ID
    async getReviewById(reviewId) {
        return Review.findById(reviewId).populate('userId', 'fullName avatar email');
    }

    // Toggle status (active/deleted)
    async toggleStatus(reviewId) {
        const review = await Review.findById(reviewId);
        if (!review) throw new Error('Không tìm thấy đánh giá');

        review.status = review.status === 'active' ? 'deleted' : 'active';
        if (review.status === 'deleted') {
            review.deletedAt = new Date();
        } else {
            review.deletedAt = null;
            review.deletedBy = null;
        }
        await review.save();
        return review.populate('userId', 'fullName avatar email');
    }

    // Delete review (admin force delete - hard delete)
    async deleteReview(reviewId) {
        const review = await Review.findByIdAndDelete(reviewId);
        if (!review) throw new Error('Không tìm thấy đánh giá');
        return review;
    }

    // Get stats for all reviews
    async getGlobalStats() {
        return Review.getStats();
    }
}

module.exports = new ReviewAdminService();
