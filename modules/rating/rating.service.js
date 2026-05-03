// modules/rating/rating.service.js
const Rating = require('./rating.model');

function getIo() {
    try {
        const { getIo } = require('../../server');
        const io = getIo?.();
        return io;
    } catch (e) {
        console.error('❌ Rating getIo error:', e.message);
        return null;
    }
}

class RatingService {
    async createRating(userId, rating, content) {
        if (!userId) {
            throw new Error('userId không được để trống');
        }
        if (rating < 1 || rating > 5) {
            throw new Error('Đánh giá phải từ 1 đến 5 sao');
        }
        if (!content || content.trim().length === 0) {
            throw new Error('Nội dung không được để trống');
        }

        const existingRating = await Rating.findOne({ userId, status: 'active' });
        if (existingRating) {
            throw new Error('Bạn đã đánh giá rồi! Chỉ được đánh giá một lần.');
        }

        const newRating = new Rating({
            userId,
            rating,
            content: content.trim()
        });

        await newRating.save();
        await newRating.populate('userId', '_id fullName email avatar username');

        // FIX: Broadcast cho tất cả mọi người (không chỉ user riêng)
        const io = getIo();
        if (io) {
            // Gửi đến tất cả client đang kết nối
            io.emit('rating_created', newRating);
            io.emit('rating_stats_updated', await Rating.getStats());
        }

        return newRating;
    }

    async updateRating(ratingId, userId, updateData) {
        const { rating, content } = updateData;

        const existingRating = await Rating.findById(ratingId);

        if (!existingRating) {
            throw new Error('Không tìm thấy đánh giá');
        }

        if (existingRating.userId.toString() !== userId.toString()) {
            throw new Error('Bạn không có quyền chỉnh sửa đánh giá này');
        }

        existingRating.rating = rating;
        existingRating.content = content.trim();

        await existingRating.save();
        await existingRating.populate('userId', '_id fullName email avatar username');

        // FIX: Broadcast cho tất cả mọi người
        const io = getIo();
        if (io) {
            io.emit('rating_updated', existingRating);
            io.emit('rating_stats_updated', await Rating.getStats());
        }

        return existingRating;
    }

    async deleteRating(ratingId, userId, isAdmin = false) {
        const rating = await Rating.findById(ratingId);

        if (!rating) {
            throw new Error('Không tìm thấy đánh giá');
        }

        if (!isAdmin && rating.userId.toString() !== userId.toString()) {
            throw new Error('Bạn không có quyền xóa đánh giá này');
        }

        await Rating.findByIdAndDelete(ratingId);

        // FIX: Broadcast cho tất cả mọi người
        const io = getIo();
        if (io) {
            io.emit('rating_deleted', ratingId);
            io.emit('rating_stats_updated', await Rating.getStats());
        }

        return { success: true };
    }

    async getRatings(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [ratings, total, stats] = await Promise.all([
            Rating.find({ status: 'active' })
                .populate('userId', '_id fullName email avatar username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Rating.countDocuments({ status: 'active' }),
            Rating.getStats()
        ]);

        return {
            ratings,
            stats,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        };
    }

    async getAllRatingsForAdmin(page = 1, limit = 20, search = '') {
        const skip = (page - 1) * limit;

        let query = { status: 'active' };
        if (search) {
            query = {
                ...query,
                $or: [
                    { content: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const [ratings, total, stats] = await Promise.all([
            Rating.find(query)
                .populate('userId', '_id fullName email avatar username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Rating.countDocuments(query),
            Rating.getStats()
        ]);

        return {
            ratings,
            stats,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        };
    }
}

module.exports = new RatingService();