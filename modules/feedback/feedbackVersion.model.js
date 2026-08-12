const mongoose = require('mongoose');

const feedbackVersionSchema = new mongoose.Schema({
    version: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        maxlength: 32,
    },
    changes: {
        type: [{ type: String, trim: true }],
        default: [],
    },
    isPublished: {
        type: Boolean,
        default: true,
    },
    releasedAt: {
        type: Date,
        default: Date.now,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

feedbackVersionSchema.index({ releasedAt: -1 });
feedbackVersionSchema.index({ isPublished: 1, releasedAt: -1 });

module.exports = mongoose.model('FeedbackVersion', feedbackVersionSchema);
