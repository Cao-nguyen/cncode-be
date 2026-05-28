const mongoose = require('mongoose');
const { generateSlug } = require('../../utils/slug');

const HelpProjectSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: [true, 'Tiêu đề là bắt buộc'],
        trim: true,
        maxlength: 200
    },
    thumbnail: {
        type: String,
        default: ''
    },
    content: {
        type: String,
        required: [true, 'Nội dung là bắt buộc']
    },
    status: {
        type: String,
        enum: ['pending', 'answered'],
        default: 'pending'
    },
    replies: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    viewCount: {
        type: Number,
        default: 0
    },
    slug: {
        type: String,
        unique: true,
        index: true
    }
}, { timestamps: true });

HelpProjectSchema.index({ userId: 1, createdAt: -1 });
HelpProjectSchema.index({ status: 1 });
HelpProjectSchema.index({ slug: 1 });

HelpProjectSchema.pre('save', function (next) {
    if (this.isModified('title') && !this.slug) {
        this.slug = generateSlug(this.title);
    }
    next();
});

const HelpProject = mongoose.models.HelpProject || mongoose.model('HelpProject', HelpProjectSchema);

module.exports = HelpProject;
