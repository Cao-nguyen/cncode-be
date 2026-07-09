const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['multiple-choice', 'true-false', 'short-answer'],
        required: true
    },
    question: { type: String, required: true },
    explanation: { type: String },

    // multiple-choice (4 options, 1 correct)
    options: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false }
    }],

    // true-false (4 options, each can be true or false)
    trueFalseOptions: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false }
    }],

    // short-answer (numbers 0-9, -, ,, max 4 chars)
    correctAnswer: { type: String, required: true }
}, { _id: true });

const exerciseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    thumbnail: { type: String },
    duration: { type: Number, required: true }, // in minutes
    questions: [questionSchema],
    totalPoints: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participantCount: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 0 } // 0 = unlimited attempts
}, {
    timestamps: true
});

exerciseSchema.pre('save', function (next) {
    if (this.questions && this.questions.length > 0) {
        this.totalPoints = this.questions.length * 10; // 10 points per question
    }
    next();
});

exerciseSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    if (update.questions && update.questions.length > 0) {
        update.totalPoints = update.questions.length * 10;
    } else if (update.$set && update.$set.questions && update.$set.questions.length > 0) {
        update.$set.totalPoints = update.$set.questions.length * 10;
    }
    next();
});

const PracticeExercise = mongoose.model('PracticeExercise', exerciseSchema);

const userExerciseAnswerSchema = new mongoose.Schema({
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeExercise', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    answers: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
        selectedOption: { type: mongoose.Schema.Types.ObjectId }, // for multiple-choice
        trueFalseAnswers: [{ // for true-false
            optionIndex: { type: Number },
            isTrue: { type: Boolean }
        }],
        shortAnswer: { type: String }, // for short-answer
        isCorrect: { type: Boolean },
        points: { type: Number, default: 0 }
    }],
    totalScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 }, // score percentage (0-100)
    timeSpent: { type: Number, default: 0 }, // in seconds
    coinsAwarded: { type: Number, default: 0 }, // coins earned for this attempt
    submittedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const UserExerciseAnswer = mongoose.model('UserExerciseAnswer', userExerciseAnswerSchema);

module.exports = { PracticeExercise, UserExerciseAnswer };
