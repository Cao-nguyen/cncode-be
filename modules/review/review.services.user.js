const Review = require('./review.model');

class ReviewUserService {
    // Get all reviews (public)
    async getAllReviews({ page = 1, limit = 10 } = {}) {
        const filter = { status: 'active' };
        const skip = (page - 1) * limit;

        const [reviews, total, stats] = await Promise.all([
            Review.find(filter)
                .populate('userId', 'fullName avatar')
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

    // Get stats (public)
    async getStats() {
        return Review.getStats();
    }

    // Get user's review
    async getUserReview(userId) {
        return Review.findOne({ userId, status: 'active' }).populate('userId', 'fullName avatar');
    }

    // Create review
    async create(userId, { rating, content }) {
        // Check duplicate review
        const existing = await Review.findOne({ userId, status: 'active' });
        if (existing) throw new Error('Bạn đã đánh giá rồi');

        const review = new Review({ userId, rating, content });
        await review.save();
        return review.populate('userId', 'fullName avatar');
    }

    // Update review
    async update(userId, reviewId, { rating, content }) {
        const review = await Review.findOne({ _id: reviewId, userId });
        if (!review) throw new Error('Không tìm thấy đánh giá');

        review.rating = rating || review.rating;
        review.content = content || review.content;
        await review.save();
        return review.populate('userId', 'fullName avatar');
    }

    // Delete review (soft delete)
    async delete(userId, reviewId) {
        const review = await Review.findOne({ _id: reviewId, userId });
        if (!review) throw new Error('Không tìm thấy đánh giá');

        review.status = 'deleted';
        review.deletedAt = new Date();
        review.deletedBy = userId;
        await review.save();
        return review;
    }
}

module.exports = new ReviewUserService();
