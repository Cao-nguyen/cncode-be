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
        trim: true,
        maxlength: 2000
    },
    category: {
        type: String,
        enum: ['bug', 'feature', 'improvement', 'other'],
        default: 'other'
    },
    status: {
        type: String,
        enum: ['pending', 'viewed', 'approved', 'in_progress', 'completed', 'rejected'],
        default: 'pending'
    },
    adminNote: {
        type: String,
        default: ''
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    likes: {
        type: Number,
        default: 0
    },
    likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    viewedAt: Date,
    approvedAt: Date,
    inProgressAt: Date,
    completedAt: Date,
    rejectedAt: Date
}, {
    timestamps: true
});

// Indexes
feedbackSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ category: 1 });
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

// Static method to get stats by status
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
        in_progress: 0,
        completed: 0,
        rejected: 0,
        total: 0
    };

    stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.total += stat.count;
    });

    return result;
};

module.exports = mongoose.model('Feedback', feedbackSchema);