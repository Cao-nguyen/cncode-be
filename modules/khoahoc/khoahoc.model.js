const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    thumbnail: { type: String },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['free', 'pro'], default: 'free' },
    price: { type: Number, default: 0 },
    discountPrice: { type: Number },
    discountPercent: { type: Number, default: 0 },
    allowCoinPayment: { type: Boolean, default: false },
    totalLessons: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    enrollCount: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'pending', 'approved', 'rejected', 'hidden'], default: 'draft' },
    rejectedReason: { type: String },
    isHidden: { type: Boolean, default: false }
}, {
    timestamps: true
});

courseSchema.pre('save', function (next) {
    if (this.price > 0 && this.discountPrice && this.discountPrice < this.price) {
        // If discountPrice is set, calculate discountPercent from it
        this.discountPercent = Math.round(((this.price - this.discountPrice) / this.price) * 100);
    } else if (this.discountPercent > 0 && this.price > 0) {
        // If discountPercent is set directly, calculate discountPrice from it
        this.discountPrice = Math.round(this.price * (1 - this.discountPercent / 100));
    } else if (this.discountPercent <= 0) {
        // No discount
        this.discountPercent = 0;
        this.discountPrice = undefined;
    }
    next();
});

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;