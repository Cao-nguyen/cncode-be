const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    type: { type: String, required: true },
    question: { type: String, required: true },
    groupTitle: { type: String },

    // New format (matching QuizPopup / contest editor)
    options: [String],
    correctAnswers: [String],
    score: { type: Number, default: 1 },
    explanation: { type: String },

    leftItems: [String],
    rightItems: [String],
    matchingPairs: [{ left: String, right: String }],

    codeMode: { type: String },
    language: { type: String },
    webRequirements: [{ type: mongoose.Schema.Types.Mixed }],
    algoRequirement: { type: String },
    algoInputDesc: { type: String },
    algoOutputDesc: { type: String },

    // Legacy format (for backward compatibility)
    legacyOptions: [{
        text: { type: String },
        isCorrect: { type: Boolean }
    }],

    trueFalseOptions: [{
        text: { type: String },
        isCorrect: { type: Boolean }
    }],

    correctAnswer: { type: String },
    maxLength: { type: Number },

    starterCode: { type: String },
    testCases: [{
        input: { type: String },
        expectedOutput: { type: String },
        isSample: { type: Boolean, default: false },
    }]
}, { _id: true });

const exerciseSchema = new mongoose.Schema({
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'KHLesson', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    questionMarkdown: { type: String, default: '' },
    trueFalseScale: {
        correct1: { type: Number, default: 10 },
        correct2: { type: Number, default: 25 },
        correct3: { type: Number, default: 50 },
        correct4: { type: Number, default: 100 },
    },
    questions: [questionSchema],
    mustPassToNext: { type: Boolean, default: true }
}, {
    timestamps: true
});

const KHExercise = mongoose.model('KHExercise', exerciseSchema);

module.exports = KHExercise;