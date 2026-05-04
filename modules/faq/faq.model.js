// modules/faq/faq.model.js
const mongoose = require('mongoose');

const faqAnswerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null  // Cho phép null (AI không có userId)
    },
    userType: {
        type: String,
        enum: ['user', 'admin', 'ai'],
        default: 'user'
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    isAccepted: {
        type: Boolean,
        default: false
    },
    isBest: {
        type: Boolean,
        default: false
    },
    likes: {
        type: Number,
        default: 0
    },
    likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isAiGenerated: {
        type: Boolean,
        default: false
    },
    aiModel: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

const faqQuestionSchema = new mongoose.Schema({
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
        enum: ['general', 'technical', 'account', 'payment', 'course', 'other'],
        default: 'general'
    },
    tags: [{
        type: String,
        trim: true
    }],
    status: {
        type: String,
        enum: ['pending', 'answered', 'resolved', 'closed'],
        default: 'pending'
    },
    answers: [faqAnswerSchema],
    views: {
        type: Number,
        default: 0
    },
    helpful: {
        type: Number,
        default: 0
    },
    notHelpful: {
        type: Number,
        default: 0
    },
    resolvedAt: Date,
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes
faqQuestionSchema.index({ userId: 1, createdAt: -1 });
faqQuestionSchema.index({ status: 1, createdAt: -1 });
faqQuestionSchema.index({ category: 1 });
faqQuestionSchema.index({ title: 'text', content: 'text' });

// Virtual populate
faqQuestionSchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true,
    select: '_id fullName email avatar username'
});

faqQuestionSchema.set('toJSON', { virtuals: true });
faqQuestionSchema.set('toObject', { virtuals: true });

// Static methods
faqQuestionSchema.statics.getStats = async function () {
    const [total, pending, answered, resolved] = await Promise.all([
        this.countDocuments(),
        this.countDocuments({ status: 'pending' }),
        this.countDocuments({ status: 'answered' }),
        this.countDocuments({ status: 'resolved' })
    ]);

    return { total, pending, answered, resolved };
};

module.exports = mongoose.model('FAQ', faqQuestionSchema);