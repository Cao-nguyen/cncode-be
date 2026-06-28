const mongoose = require('mongoose');
const { generateSlug } = require('../../utils/slug');

const questionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['quiz', 'true-false', 'short-answer', 'essay', 'code'],
        required: true,
    },
    question: { type: String, required: true },
    points: { type: Number, default: 1 },

    // Trắc nghiệm — 4 phương án, chọn 1 đúng
    options: [{
        text: { type: String },
        isCorrect: { type: Boolean, default: false },
    }],

    // Đúng/Sai — mỗi phương án đúng hoặc sai
    trueFalseOptions: [{
        text: { type: String },
        isCorrect: { type: Boolean, default: false },
    }],

    // Trả lời ngắn
    correctAnswer: { type: String },
    maxLength: { type: Number, default: 4 },

    // Code
    language: {
        type: String,
        enum: ['python', 'pascal', 'cpp', 'csharp', 'html', 'css', 'javascript'],
    },
    starterCode: { type: String, default: '' },
    testCases: [{
        input: { type: String, default: '' },
        expectedOutput: { type: String, required: true },
    }],
}, { _id: true });

const practiceSetSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 300 },
    slug: { type: String, unique: true, sparse: true, index: true },
    description: { type: String, default: '', trim: true },
    tier: { type: String, enum: ['free', 'pro'], default: 'free' },
    status: {
        type: String,
        enum: ['draft', 'pending', 'approved', 'rejected'],
        default: 'draft',
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    questions: { type: [questionSchema], default: [] },
    timeLimit: { type: Number, default: 0 },
    passThreshold: { type: Number, default: 80 },
    rejectionReason: { type: String, default: '' },
    attemptCount: { type: Number, default: 0 },
    publishedAt: { type: Date },
}, { timestamps: true });

practiceSetSchema.pre('save', function (next) {
    if (!this.slug && this.title) {
        this.slug = generateSlug(this.title);
    }
    next();
});

const attemptSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    practiceSetId: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeSet', required: true, index: true },
    answers: [{
        questionId: { type: String, required: true },
        answer: { type: mongoose.Schema.Types.Mixed },
    }],
    score: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    coinsAwarded: { type: Number, default: 0 },
    questionResults: [{
        questionId: String,
        isCorrect: Boolean,
        pointsEarned: Number,
        feedback: String,
    }],
}, { timestamps: true });

attemptSchema.index({ userId: 1, practiceSetId: 1, createdAt: -1 });

const PracticeSet = mongoose.model('PracticeSet', practiceSetSchema);
const PracticeAttempt = mongoose.model('PracticeAttempt', attemptSchema);

module.exports = { PracticeSet, PracticeAttempt };
