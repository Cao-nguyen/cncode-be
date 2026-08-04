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

blogSchema.virtual('authorInfo', {
    ref: 'User',
    localField: 'author',
    foreignField: '_id',
    justOne: true,
    select: '_id fullName email avatar username'
});

blogSchema.set('toJSON', { virtuals: true });
blogSchema.set('toObject', { virtuals: true });

blogSchema.statics.getCategoryStats = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 }
            }
        }
    ]);

    const result = {
        technology: 0,
        education: 0,
        news: 0,
        contest: 0,
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

blogSchema.statics.getPublishStatusStats = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$isPublished',
                count: { $sum: 1 }
            }
        }
    ]);

    const result = {
        published: 0,
        draft: 0,
        total: 0
    };

    stats.forEach(stat => {
        if (stat._id === true) {
            result.published = stat.count;
        } else if (stat._id === false) {
            result.draft = stat.count;
        }
        result.total += stat.count;
    });

    return result;
};

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