const mongoose = require('mongoose');

const shortLinkSchema = new mongoose.Schema({
    shortCode: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
        lowercase: true,
    },
    originalUrl: {
        type: String,
        required: true,
        trim: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    isCustom: {
        type: Boolean,
        default: false,
    },
    clicks: {
        type: Number,
        default: 0,
        min: 0,
    },
    expiresAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
});

shortLinkSchema.index({ createdAt: -1 });
shortLinkSchema.index({ clicks: -1 });
shortLinkSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ShortLink', shortLinkSchema);