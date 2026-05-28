
const mongoose = require('mongoose');
const { generateSlug } = require('../../utils/slug');

const questionSchema = new mongoose.Schema(
    {
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
            maxlength: 500,
        },
        content: {
            type: String,
            required: [true, 'Nội dung là bắt buộc'],
        },
        grade: {
            type: String,
            enum: ['grade10', 'grade11', 'grade12', 'other'],
            default: 'other',
        },
        isAnonymous: {
            type: Boolean,
            default: false,
        },
        viewCount: {
            type: Number,
            default: 0,
        },
        answerCount: {
            type: Number,
            default: 0,
        },
        likeCount: {
            type: Number,
            default: 0,
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        isLocked: {
            type: Boolean,
            default: false,
        },
        isSolved: {
            type: Boolean,
            default: false,
        },
        bestAnswerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Answer',
        },
        slug: {
            type: String,
            unique: true,
            index: true,
        },
    },
    { timestamps: true }
);

const answerSchema = new mongoose.Schema(
    {
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question',
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        content: {
            type: String,
            required: [true, 'Nội dung trả lời là bắt buộc'],
        },
        isBestAnswer: {
            type: Boolean,
            default: false,
        },
        isEdited: {
            type: Boolean,
            default: false,
        },
        likeCount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

const questionLikeSchema = new mongoose.Schema(
    {
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question',
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true }
);

const answerLikeSchema = new mongoose.Schema(
    {
        answerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Answer',
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true }
);

questionSchema.index({ userId: 1, createdAt: -1 });
questionSchema.index({ grade: 1 });
questionSchema.index({ viewCount: -1 });
questionSchema.index({ likeCount: -1 });
questionSchema.index({ slug: 1 });
answerSchema.index({ questionId: 1, isBestAnswer: -1, createdAt: 1 });
questionLikeSchema.index({ questionId: 1, userId: 1 }, { unique: true });
answerLikeSchema.index({ answerId: 1, userId: 1 }, { unique: true });

questionSchema.pre('save', function (next) {
    if (this.isModified('title') && !this.slug) {
        this.slug = generateSlug(this.title);
    }
    next();
});

const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);
const Answer = mongoose.models.Answer || mongoose.model('Answer', answerSchema);
const QuestionLike = mongoose.models.QuestionLike || mongoose.model('QuestionLike', questionLikeSchema);
const AnswerLike = mongoose.models.AnswerLike || mongoose.model('AnswerLike', answerLikeSchema);

module.exports = { Question, Answer, QuestionLike, AnswerLike };
