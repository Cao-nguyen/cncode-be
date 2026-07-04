const mongoose = require('mongoose');

const forumPostSchema = new mongoose.Schema(
    {
        content: {
            type: String,
            required: [true, 'Nội dung bài viết là bắt buộc'],
            trim: true,
            maxlength: 5000,
        },
        images: [{
            type: String,
        }],
        videos: [{
            type: String,
        }],
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        reactions: {
            like: { type: Number, default: 0 },
            love: { type: Number, default: 0 },
            haha: { type: Number, default: 0 },
            wow: { type: Number, default: 0 },
            sad: { type: Number, default: 0 },
            angry: { type: Number, default: 0 },
        },
        userReactions: [{
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
            reaction: {
                type: String,
                enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
            },
        }],
        likeCount: {
            type: Number,
            default: 0,
        },
        commentCount: {
            type: Number,
            default: 0,
        },
        shares: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        shareCount: {
            type: Number,
            default: 0,
        },
        privacy: {
            type: String,
            enum: ['public', 'friends', 'private'],
            default: 'public',
        },
        feeling: {
            type: String,
            enum: ['happy', 'sad', 'angry', 'love', 'surprised', null],
            default: null,
        },
        location: {
            type: String,
            trim: true,
        },
        taggedUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        isPinned: {
            type: Boolean,
            default: false,
        },
        isEdited: {
            type: Boolean,
            default: false,
        },
        editedAt: {
            type: Date,
        },
        originalPost: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ForumPost',
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

forumPostSchema.index({ author: 1, createdAt: -1 });
forumPostSchema.index({ createdAt: -1 });
forumPostSchema.index({ likeCount: -1 });
forumPostSchema.index({ commentCount: -1 });
forumPostSchema.index({ isPinned: -1, createdAt: -1 });

const ForumPost = mongoose.models.ForumPost || mongoose.model('ForumPost', forumPostSchema);

module.exports = { ForumPost };
