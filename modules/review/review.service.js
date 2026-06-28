const Review = require('./review.model');
const Course = require('../khoahoc/khoahoc.model');

class ReviewService {
    // ===== PUBLIC =====
    async getByTarget(targetType, targetId, { page = 1, limit = 10 } = {}) {
        const filter = { targetType, targetId, isHidden: false };
        const skip = (page - 1) * limit;

        const [reviews, total, stats] = await Promise.all([
            Review.find(filter)
                .populate('userId', 'fullName avatar')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Review.countDocuments(filter),
            this.getStats(targetType, targetId)
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

    async getStats(targetType, targetId) {
        const reviews = await Review.find({ targetType, targetId, isHidden: false });
        const total = reviews.length;
        if (total === 0) return { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

        const sum = reviews.reduce((s, r) => s + r.rating, 0);
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach(r => { distribution[r.rating]++; });

        return {
            average: Math.round((sum / total) * 10) / 10,
            total,
            distribution
        };
    }

    // ===== USER =====
    async create(userId, { targetType, targetId, rating, comment }) {
        // Check duplicate review
        const existing = await Review.findOne({ userId, targetType, targetId });
        if (existing) throw new Error('Bạn đã đánh giá mục này rồi');

        const review = new Review({ userId, targetType, targetId, rating, comment });
        await review.save();
        return review.populate('userId', 'fullName avatar');
    }

    async update(userId, reviewId, { rating, comment }) {
        const review = await Review.findOne({ _id: reviewId, userId });
        if (!review) throw new Error('Không tìm thấy đánh giá');

        review.rating = rating || review.rating;
        review.comment = comment || review.comment;
        await review.save();
        return review.populate('userId', 'fullName avatar');
    }

    async delete(userId, reviewId) {
        const review = await Review.findOneAndDelete({ _id: reviewId, userId });
        if (!review) throw new Error('Không tìm thấy đánh giá');
        return review;
    }

    async getUserReview(userId, targetType, targetId) {
        return Review.findOne({ userId, targetType, targetId }).populate('userId', 'fullName avatar');
    }
}

module.exports = new ReviewService();