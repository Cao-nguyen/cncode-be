const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
    input: { type: String, default: '' },
    expectedOutput: { type: String, default: '' },
    isSample: { type: Boolean, default: false }
}, { _id: true });

const webRequirementSchema = new mongoose.Schema({
    type: { type: String, enum: ['has-tag', 'has-text', 'has-style', 'contains'], required: true },
    selector: { type: String },
    tag: { type: String },
    property: { type: String },
    value: { type: String },
    text: { type: String }
}, { _id: true });

const questionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['multiple-choice', 'multiple-select', 'true-false', 'matching', 'short-answer', 'essay', 'code'],
        required: true
    },
    question: { type: String, required: true },
    explanation: { type: String },
    points: { type: Number, default: 10 },

    options: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false }
    }],

    trueFalseOptions: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false }
    }],

    correctAnswer: { type: String, default: '' },

    leftItems: [{ text: { type: String, required: true } }],
    rightItems: [{ text: { type: String, required: true } }],
    matchingPairs: [{ leftIndex: { type: Number, required: true }, rightIndex: { type: Number, required: true } }],

    // code question
    codeMode: { type: String, enum: ['algorithm', 'web'], default: 'algorithm' },
    language: { type: String, default: 'python' },
    starterCode: { type: String, default: '' },
    testCases: [testCaseSchema],
    webRequirements: [webRequirementSchema],
    sampleAnswer: { type: String, default: '' }
}, { _id: true });

const exerciseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    thumbnail: { type: String },
    duration: { type: Number, required: true },
    questions: [questionSchema],
    totalPoints: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['draft', 'pending', 'published', 'rejected'],
        default: 'draft'
    },
    tier: { type: String, enum: ['free', 'pro'], default: 'free' },
    price: { type: Number, default: 0 },
    discountType: { type: String, enum: ['percent', 'vnd'], default: 'percent' },
    discountValue: { type: Number, default: 0 },
    discountPrice: { type: Number, default: 0 },
    allowCoinPayment: { type: Boolean, default: false },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    passThreshold: { type: Number, default: 80 },
    creationMethod: { type: String, enum: ['editor', 'upload'], default: 'editor' },
    rejectionReason: { type: String, default: '' },
    grade: { type: String, default: '' },
    examPurpose: { type: String, default: '' },
    deliveryFrom: { type: Date },
    deliveryTo: { type: Date },
    examPassword: { type: String, default: '' },
    proctoring: { type: String, enum: ['off', 'tab-switch'], default: 'off' },
    verifyStudentInfo: { type: Boolean, default: false },
    studentInfoFields: {
        fullName: { type: Boolean, default: true },
        className: { type: Boolean, default: true },
        custom: [{ label: { type: String }, required: { type: Boolean, default: false } }],
    },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleAnswers: { type: Boolean, default: false },
    essayKeyboard: { type: String, enum: ['basic', 'math', 'editor'], default: 'basic' },
    showScoreWhen: { type: String, enum: ['never', 'after-submit', 'after-expiry'], default: 'after-submit' },
    showAnswersWhen: { type: String, enum: ['never', 'after-submit', 'after-expiry'], default: 'never' },
    hideLeaderboard: { type: Boolean, default: false },
    preExamNoticeEnabled: { type: Boolean, default: false },
    preExamNotice: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participantCount: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 0 },
    trueFalseScale: {
        correct1: { type: Number, default: 10 },
        correct2: { type: Number, default: 25 },
        correct3: { type: Number, default: 50 },
        correct4: { type: Number, default: 100 },
    }
}, {
    timestamps: true
});

exerciseSchema.pre('save', function (next) {
    if (this.questions && this.questions.length > 0) {
        this.totalPoints = this.questions.reduce((sum, q) => sum + (q.points || 10), 0);
    }
    if (this.tier === 'free') {
        this.price = 0;
        this.discountValue = 0;
        this.discountPrice = 0;
        this.allowCoinPayment = false;
    } else if (this.price > 0) {
        if (this.discountType === 'percent' && this.discountValue > 0) {
            this.discountPrice = Math.max(0, Math.round(this.price * (1 - this.discountValue / 100)));
        } else if (this.discountType === 'vnd' && this.discountValue > 0) {
            this.discountPrice = Math.max(0, this.price - this.discountValue);
        } else {
            this.discountPrice = this.price;
        }
    } else {
        this.discountPrice = 0;
    }
    next();
});

exerciseSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    const set = update.$set || update;
    const questions = set.questions || update.questions;
    if (questions && questions.length > 0) {
        const totalPoints = questions.reduce((sum, q) => sum + (q.points || 10), 0);
        if (update.$set) update.$set.totalPoints = totalPoints;
        else update.totalPoints = totalPoints;
    }
    const tier = set.tier;
    const price = set.price;
    const discountType = set.discountType;
    const discountValue = set.discountValue;
    if (tier === 'free') {
        if (update.$set) {
            update.$set.price = 0;
            update.$set.discountValue = 0;
            update.$set.discountPrice = 0;
            update.$set.allowCoinPayment = false;
        }
    } else if (price > 0) {
        let discountPrice = price;
        if (discountType === 'percent' && discountValue > 0) {
            discountPrice = Math.max(0, Math.round(price * (1 - discountValue / 100)));
        } else if (discountType === 'vnd' && discountValue > 0) {
            discountPrice = Math.max(0, price - discountValue);
        }
        if (update.$set) update.$set.discountPrice = discountPrice;
        else update.discountPrice = discountPrice;
    }
    next();
});

const PracticeExercise = mongoose.model('PracticeExercise', exerciseSchema);

const userExerciseAnswerSchema = new mongoose.Schema({
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeExercise', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    answers: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
        selectedOption: { type: mongoose.Schema.Types.ObjectId },
        selectedOptions: [{ type: mongoose.Schema.Types.ObjectId }],
        matchingAnswers: [{ leftIndex: { type: Number }, rightIndex: { type: Number } }],
        trueFalseAnswers: [{
            optionIndex: { type: Number },
            isTrue: { type: Boolean }
        }],
        shortAnswer: { type: String },
        essayAnswer: { type: String },
        codeAnswer: { type: String },
        isCorrect: { type: Boolean },
        points: { type: Number, default: 0 },
        feedback: { type: String, default: '' }
    }],
    totalScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 },
    coinsAwarded: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const UserExerciseAnswer = mongoose.model('UserExerciseAnswer', userExerciseAnswerSchema);

module.exports = { PracticeExercise, UserExerciseAnswer };
