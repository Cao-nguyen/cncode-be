
const mongoose = require('mongoose');

const helpCenterSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    answer: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['account', 'payment', 'course', 'technical', 'other'],
        default: 'other'
    },
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    views: {
        type: Number,
        default: 0
    },
    helpfulCount: {
        type: Number,
        default: 0
    },
    helpfulUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

helpCenterSchema.index({ category: 1, order: 1 });
helpCenterSchema.index({ isActive: 1, order: 1 });
helpCenterSchema.index({ question: 'text' });

module.exports = mongoose.model('HelpCenter', helpCenterSchema);
