const mongoose = require('mongoose');
const { generateSlug } = require('../../utils/slug');

const blogSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Tiêu đề là bắt buộc'],
            trim: true,
            maxlength: 200,
        },
        slug: {
            type: String,
            unique: true,
            index: true,
        },
        thumbnail: {
            type: String,
            default: '',
        },
        excerpt: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        content: {
            type: String,
            required: [true, 'Nội dung là bắt buộc'],
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        category: {
            type: String,
            enum: ['technology', 'education', 'news', 'contest', 'other'],
            default: 'other',
        },
        tags: [{
            type: String,
            trim: true,
        }],
        isPublished: {
            type: Boolean,
            default: false
        },
        publishedAt: {
            type: Date
        },
        rejectionReason: {
            type: String,
            trim: true,
        },
        needsReview: {
            type: Boolean,
            default: false
        },
        viewCount: {
            type: Number,
            default: 0,
        },
        likeCount: {
            type: Number,
            default: 0,
        },
        commentCount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

blogSchema.index({ author: 1, createdAt: -1 });
blogSchema.index({ category: 1, isPublished: 1 });
blogSchema.index({ isPublished: 1, publishedAt: -1 });
blogSchema.index({ viewCount: -1 });
blogSchema.index({ slug: 1 });

blogSchema.pre('save', function (next) {
    if (this.isModified('title') && !this.slug) {
        this.slug = generateSlug(this.title);
    }

    if (this.isModified('isPublished') && this.isPublished && !this.publishedAt) {
        this.publishedAt = new Date();
    }

    if (!this.excerpt && this.content) {
        const plainText = this.content.replace(/<[^>]*>/g, '');
        this.excerpt = plainText.substring(0, 200) + (plainText.length > 200 ? '...' : '');
    }

    next();
});

const Blog = mongoose.models.Blog || mongoose.model('Blog', blogSchema);

module.exports = { Blog };