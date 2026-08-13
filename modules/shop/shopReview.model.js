const mongoose = require('mongoose');

const shopReviewSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000,
    },
}, {
    timestamps: true,
});

shopReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
shopReviewSchema.index({ productId: 1, createdAt: -1 });

shopReviewSchema.statics.getStatsForProduct = async function (productId) {
    const objectId = new mongoose.Types.ObjectId(String(productId));
    const [summary, distribution] = await Promise.all([
        this.aggregate([
            { $match: { productId: objectId } },
            {
                $group: {
                    _id: null,
                    average: { $avg: '$rating' },
                    total: { $sum: 1 },
                },
            },
        ]),
        this.aggregate([
            { $match: { productId: objectId } },
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: -1 } },
        ]),
    ]);

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach((item) => {
        dist[item._id] = item.count;
    });

    return {
        average: summary[0]?.average ? Math.round(summary[0].average * 10) / 10 : 0,
        total: summary[0]?.total || 0,
        distribution: dist,
    };
};

const ShopReview = mongoose.models.ShopReview || mongoose.model('ShopReview', shopReviewSchema);

module.exports = ShopReview;
