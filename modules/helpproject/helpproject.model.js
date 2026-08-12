const mongoose = require('mongoose');
const { generateSlug } = require('../../utils/slug');

const replySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const helpProjectSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Tiêu đề là bắt buộc'],
        trim: true,
        maxlength: 200,
    },
    thumbnail: {
        type: String,
        default: '',
    },
    content: {
        type: String,
        required: [true, 'Nội dung là bắt buộc'],
    },
    status: {
        type: String,
        enum: ['pending', 'answered'],
        default: 'pending',
    },
    isPublic: {
        type: Boolean,
        default: false,
    },
    replies: [replySchema],
    viewCount: {
        type: Number,
        default: 0,
    },
    slug: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
    },
}, { timestamps: true });

helpProjectSchema.index({ userId: 1, createdAt: -1 });
helpProjectSchema.index({ status: 1, createdAt: -1 });

helpProjectSchema.pre('save', function (next) {
    if (this.isModified('title') && !this.slug) {
        this.slug = generateSlug(this.title);
    }
    next();
});

const HelpProject = mongoose.models.HelpProject || mongoose.model('HelpProject', helpProjectSchema);

module.exports = { HelpProject };
