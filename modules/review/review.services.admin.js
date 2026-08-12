const Review = require('./review.model');
const User = require('../user/user.model');

class ReviewAdminService {
    // Get all reviews with pagination and filtering
    async getAllReviews({ page = 1, limit = 10, status = 'active', search, rating } = {}) {
        const filter = {};

        if (status && status !== 'all') {
            filter.status = status;
        } else if (status !== 'all') {
            filter.status = 'active';
        }

        if (rating && rating !== 'all') {
            filter.rating = Number(rating);
        }

        if (search?.trim()) {
            const userIds = await User.find({
                fullName: { $regex: search.trim(), $options: 'i' },
            }).distinct('_id');

            filter.$or = [
                { content: { $regex: search.trim(), $options: 'i' } },
                ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
            ];
        }

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
        
        // Emit socket event
        const io = global.io;
        if (io) {
            io.emit('review_updated', review);
            io.emit('review_stats_updated', await Review.getStats());
        }
        
        return review.populate('userId', 'fullName avatar email');
    }

    // Delete review (admin force delete - hard delete)
    async deleteReview(reviewId) {
        const review = await Review.findByIdAndDelete(reviewId);
        if (!review) throw new Error('Không tìm thấy đánh giá');
        
        // Emit socket event
        const io = global.io;
        if (io) {
            io.emit('review_deleted', reviewId);
            io.emit('review_stats_updated', await Review.getStats());
        }
        
        return review;
    }

    // Get stats for all reviews
    async getGlobalStats() {
        return Review.getStats();
    }
}

module.exports = new ReviewAdminService();
