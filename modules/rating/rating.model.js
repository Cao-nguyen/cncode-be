const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ['active', 'deleted'],
        default: 'active'
    },
    deletedAt: Date,
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index
ratingSchema.index({ createdAt: -1 });
ratingSchema.index({ rating: -1 });
ratingSchema.index({ userId: 1, createdAt: -1 });
ratingSchema.index({ status: 1, createdAt: -1 });

// FIX: Không thể tạo virtual cùng tên với field có sẵn
// Đổi tên virtual thành 'user' thay vì 'userId'
ratingSchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true
});

ratingSchema.set('toJSON', { virtuals: true });
ratingSchema.set('toObject', { virtuals: true });

// Static method get stats
ratingSchema.statics.getStats = async function () {
    const match = { status: 'active' };

    const [stats, distribution] = await Promise.all([
        this.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    average: { $avg: '$rating' },
                    total: { $sum: 1 }
                }
            }
        ]),
        this.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$rating',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: -1 } }
        ])
    ]);

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach(item => {
        dist[item._id] = item.count;
    });

    return {
        average: stats[0]?.average || 0,
        total: stats[0]?.total || 0,
        distribution: dist
    };
};

module.exports = mongoose.model('Rating', ratingSchema);