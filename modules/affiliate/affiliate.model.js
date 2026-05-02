// modules/affiliate/affiliate.model.js
const mongoose = require('mongoose');

const affiliateLinkSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    code: {
        type: String,
        required: true,
        unique: true,
    },
    clicks: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const affiliateUserSchema = new mongoose.Schema({
    affiliateCode: {
        type: String,
        required: true,
    },
    affiliateUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    targetEmail: {
        type: String,
        required: true,
    },
    targetName: {
        type: String,
        required: true,
    },
    registeredAt: {
        type: Date,
        default: Date.now,
    },
    hasPosted: {
        type: Boolean,
        default: false,
    },
    postedAt: {
        type: Date,
        default: null,
    },
    hasTakenQuiz: {
        type: Boolean,
        default: false,
    },
    takenQuizAt: {
        type: Date,
        default: null,
    },
    coinsEarned: {
        type: Number,
        default: 0,
    },
});

affiliateLinkSchema.index({ code: 1 });
affiliateUserSchema.index({ affiliateCode: 1 });
affiliateUserSchema.index({ affiliateUserId: 1 });
affiliateUserSchema.index({ targetUserId: 1 });

module.exports = {
    AffiliateLink: mongoose.model('AffiliateLink', affiliateLinkSchema),
    AffiliateUser: mongoose.model('AffiliateUser', affiliateUserSchema),
};