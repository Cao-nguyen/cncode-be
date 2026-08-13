const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    slug: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
    },
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
    discountType: {
        type: String,
        enum: ['percent', 'vnd'],
        default: 'percent',
    },
    discountValue: {
        type: Number,
        default: 0,
        min: 0,
    },
    discountPrice: {
        type: Number,
        min: 0,
    },
    allowCoinPayment: {
        type: Boolean,
        default: true,
    },
    coverImage: {
        type: String,
        default: '',
    },
    category: {
        type: String,
        required: true,
        enum: ['Tài liệu', 'PowerPoint', 'Code', 'Khác']
    },
    images: [{
        type: String // URLs to images
    }],
    files: [{
        url: { type: String },
        name: { type: String },
        size: { type: Number },
        type: { type: String },
    }],
    preview: {
        url: { type: String, default: '' },
        name: { type: String, default: '' },
        size: { type: Number, default: 0 },
        type: { type: String, default: '' },
    },
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
    downloads: {
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
productSchema.index({ slug: 1 });
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