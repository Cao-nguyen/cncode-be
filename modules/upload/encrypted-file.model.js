/**
 * Encrypted File Model - Lưu metadata của file đã mã hóa trên Telegram
 */
const mongoose = require('mongoose');

const encryptedFileSchema = new mongoose.Schema(
    {
        fileId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true
        },
        type: {
            type: String,
            enum: ['image', 'video', 'document'],
            required: true,
            index: true
        },
        encrypted: {
            type: Boolean,
            default: true
        },
        originalName: {
            type: String,
            required: true
        },
        mimeType: {
            type: String,
            required: true
        },
        size: {
            type: Number,
            required: true
        },
        telegramMessageId: {
            type: String,
            required: true,
            index: true
        },
        // For images
        placeholder: {
            type: String // Base64 blur placeholder
        },
        // For videos with HLS segments
        segments: [{
            index: Number,
            telegramMessageId: String,
            duration: Number, // seconds
            size: Number
        }],
        totalDuration: {
            type: Number // Total video duration in seconds
        },
        // For documents (PDF)
        pages: [{
            pageNumber: Number,
            telegramMessageId: String,
            size: Number
        }],
        totalPages: {
            type: Number
        },
        // Original file for documents (để download)
        originalFileMessageId: {
            type: String
        },
        // Access control
        isPublic: {
            type: Boolean,
            default: false
        },
        accessCount: {
            type: Number,
            default: 0
        },
        lastAccessedAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

// Indexes
encryptedFileSchema.index({ userId: 1, type: 1 });
encryptedFileSchema.index({ createdAt: -1 });

// TTL index - tự động xóa sau 30 ngày (có thể tùy chỉnh)
encryptedFileSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days
);

// Virtual for proxy URL
encryptedFileSchema.virtual('url').get(function () {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    if (this.type === 'image') {
        return `${backendUrl}/api/test-up/image/${this.fileId}`;
    }
    if (this.type === 'video') {
        return `${backendUrl}/api/test-up/stream/video/${this.fileId}`;
    }
    return `${backendUrl}/api/test-up/${this.type}/${this.fileId}`;
});

// Method để tăng access count
encryptedFileSchema.methods.incrementAccess = function () {
    this.accessCount += 1;
    this.lastAccessedAt = new Date();
    return this.save();
};

// Ensure virtuals are included in JSON
encryptedFileSchema.set('toJSON', { virtuals: true });
encryptedFileSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('EncryptedFile', encryptedFileSchema);