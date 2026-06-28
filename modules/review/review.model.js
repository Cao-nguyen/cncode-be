const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['course', 'product'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    isHidden: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Index để query nhanh
reviewSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;