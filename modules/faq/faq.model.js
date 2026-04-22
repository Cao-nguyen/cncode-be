// modules/faq/faq.model.js
const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },
    answer: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['general', 'account', 'payment', 'course', 'product', 'other'],
        default: 'general'
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
    helpful: {
        type: Number,
        default: 0
    },
    notHelpful: {
        type: Number,
        default: 0
    },
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

faqSchema.index({ category: 1, order: 1 });

module.exports = mongoose.model('FAQ', faqSchema);