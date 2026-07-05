const mongoose = require('mongoose');

const uploadJobSchema = new mongoose.Schema(
    {
        jobId: { type: String, required: true, unique: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        type: { type: String, enum: ['image', 'document', 'video'], required: true },
        status: {
            type: String,
            enum: ['queued', 'processing', 'done', 'failed'],
            default: 'queued',
        },
        progress: { type: Number, default: 0, min: 0, max: 100 },
        fileName: { type: String },
        mimeType: { type: String },
        tempPath: { type: String },
        placeholder: { type: String },
        messageId: { type: String },
        url: { type: String },
        previewUrl: { type: String },
        pages: [{
            pageIndex: Number,
            messageId: String,
            url: String,
        }],
        totalPages: { type: Number, default: 0 },
        error: { type: String },
    },
    { timestamps: true }
);

uploadJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('UploadJob', uploadJobSchema);
