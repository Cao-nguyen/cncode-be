
const mongoose = require('mongoose');

const commentReportSchema = new mongoose.Schema({
    commentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        required: true,
        index: true
    },
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    reason: {
        type: String,
        enum: ['spam', 'harassment', 'hate_speech', 'violence', 'misinformation', 'inappropriate', 'other'],
        required: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'reviewing', 'resolved', 'rejected'],
        default: 'pending'
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    actionTaken: {
        type: String,
        enum: ['none', 'warning', 'delete_comment', 'mute_user', 'ban_user'],
        default: 'none'
    }
}, {
    timestamps: true
});

commentReportSchema.index({ commentId: 1, status: 1 });
commentReportSchema.index({ reporterId: 1, createdAt: -1 });
commentReportSchema.index({ status: 1, createdAt: -1 });

const CommentReport = mongoose.models.CommentReport || mongoose.model('CommentReport', commentReportSchema);

module.exports = CommentReport;
