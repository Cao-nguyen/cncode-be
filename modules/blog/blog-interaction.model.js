const mongoose = require('mongoose');

// Blog Like Schema
const blogLikeSchema = new mongoose.Schema(
    {
        blogId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Blog',
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
    },
    { timestamps: true }
);

// Compound index để đảm bảo user chỉ like 1 lần
blogLikeSchema.index({ blogId: 1, userId: 1 }, { unique: true });

// Blog Bookmark Schema
const blogBookmarkSchema = new mongoose.Schema(
    {
        blogId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Blog',
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
    },
    { timestamps: true }
);

// Compound index để đảm bảo user chỉ bookmark 1 lần
blogBookmarkSchema.index({ blogId: 1, userId: 1 }, { unique: true });

const BlogLike = mongoose.models.BlogLike || mongoose.model('BlogLike', blogLikeSchema);
const BlogBookmark = mongoose.models.BlogBookmark || mongoose.model('BlogBookmark', blogBookmarkSchema);

module.exports = { BlogLike, BlogBookmark };