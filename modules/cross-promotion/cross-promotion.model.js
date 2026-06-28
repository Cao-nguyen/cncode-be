const mongoose = require('mongoose');

const crossPromotionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Tiêu đề là bắt buộc'],
            trim: true,
            maxlength: 200,
        },
        content: {
            type: String,
            required: [true, 'Nội dung là bắt buộc'],
        },
        cooperationType: {
            type: String,
            enum: ['blog-post', 'fanpage-post'],
            required: [true, 'Loại hợp tác là bắt buộc'],
        },
        requester: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        requesterInfo: {
            organizationName: String,
            contactEmail: String,
            contactPhone: String,
            website: String,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'completed'],
            default: 'pending',
            index: true,
        },
        adminResponse: {
            message: String,
            respondedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
            respondedAt: Date,
        },
        completedAt: Date,
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Index for efficient querying
crossPromotionSchema.index({ createdAt: -1 });
crossPromotionSchema.index({ status: 1, createdAt: -1 });
crossPromotionSchema.index({ requester: 1, createdAt: -1 });

module.exports = mongoose.model('CrossPromotion', crossPromotionSchema);