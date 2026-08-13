const mongoose = require('mongoose');

const contentViewSchema = new mongoose.Schema({
    targetType: {
        type: String,
        required: true,
        enum: ['help_center', 'help_project', 'faq_question', 'shop_product'],
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    viewerKey: {
        type: String,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    guestId: {
        type: String,
        default: null,
    },
}, { timestamps: true });

contentViewSchema.index({ targetType: 1, targetId: 1, viewerKey: 1 }, { unique: true });
contentViewSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

const ContentView = mongoose.models.ContentView || mongoose.model('ContentView', contentViewSchema);

module.exports = ContentView;
