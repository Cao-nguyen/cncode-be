// modules/feedback/feedback.model.js
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['bug', 'ui_ux', 'feature_request', 'performance', 'security', 'other'],
        default: 'other'
    },
    status: {
        type: String,
        enum: ['pending', 'viewed', 'approved', 'improving', 'completed', 'rejected'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    reactCount: {
        type: Number,
        default: 0
    },
    likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    commentCount: {
        type: Number,
        default: 0
    },
    viewCount: {
        type: Number,
        default: 0
    },
    adminResponse: {
        type: String,
        default: ''
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewedAt: Date,
    isPinned: {
        type: Boolean,
        default: false
    },
    isLocked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes
feedbackSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ category: 1 });
feedbackSchema.index({ priority: 1 });
feedbackSchema.index({ createdAt: -1 });

// Virtual populate user
feedbackSchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true,
    select: '_id fullName email avatar username'
});

feedbackSchema.set('toJSON', { virtuals: true });
feedbackSchema.set('toObject', { virtuals: true });

// ✅ THÊM METHOD getStatusStats
feedbackSchema.statics.getStatusStats = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const result = {
        pending: 0,
        viewed: 0,
        approved: 0,
        improving: 0,
        completed: 0,
        rejected: 0,
        total: 0
    };

    stats.forEach(stat => {
        if (result.hasOwnProperty(stat._id)) {
            result[stat._id] = stat.count;
        }
        result.total += stat.count;
    });

    return result;
};

// ✅ THÊM METHOD getCategoryStats
feedbackSchema.statics.getCategoryStats = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 }
            }
        }
    ]);

    const result = {
        bug: 0,
        ui_ux: 0,
        feature_request: 0,
        performance: 0,
        security: 0,
        other: 0,
        total: 0
    };

    stats.forEach(stat => {
        if (result.hasOwnProperty(stat._id)) {
            result[stat._id] = stat.count;
        }
        result.total += stat.count;
    });

    return result;
};

module.exports = mongoose.model('Feedback', feedbackSchema);