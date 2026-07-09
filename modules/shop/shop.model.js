const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        required: true,
        enum: ['Tài liệu', 'Bài thuyết trình', 'Code', 'Thiết kế', 'Khác']
    },
    images: [{
        type: String // URLs to images
    }],
    files: [{
        url: String,
        name: String,
        size: Number,
        type: String
    }],
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    views: {
        type: Number,
        default: 0
    },
    purchases: {
        type: Number,
        default: 0
    },
    tags: [String],
    featured: {
        type: Boolean,
        default: false
    },
    rejectionReason: String
}, {
    timestamps: true
});

// Indexes for better query performance
productSchema.index({ seller: 1, status: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ createdAt: -1 });

// Virtual for seller info
productSchema.virtual('sellerInfo', {
    ref: 'User',
    localField: 'seller',
    foreignField: '_id',
    justOne: true
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;