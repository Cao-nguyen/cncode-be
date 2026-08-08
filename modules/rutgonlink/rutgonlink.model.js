const mongoose = require('mongoose');

const rutGonLinkSchema = new mongoose.Schema(
    {
        originalUrl: {
            type: String,
            required: [true, 'URL gốc là bắt buộc'],
            trim: true,
        },
        shortCode: {
            type: String,
            required: [true, 'Mã rút gọn là bắt buộc'],
            unique: true,
            trim: true,
            maxlength: 50,
        },
        clickCount: {
            type: Number,
            default: 0,
        },
        expiresAt: {
            type: Date,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true }
);

rutGonLinkSchema.index({ shortCode: 1 });
rutGonLinkSchema.index({ createdBy: 1 });
rutGonLinkSchema.index({ createdAt: -1 });

const RutGonLink = mongoose.models.RutGonLink || mongoose.model('RutGonLink', rutGonLinkSchema);

module.exports = { RutGonLink };
