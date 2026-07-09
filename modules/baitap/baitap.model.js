const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    type: { type: String, enum: ['quiz', 'true-false', 'short-answer', 'ide'], required: true },
    question: { type: String, required: true },

    // New format (matching QuizPopup)
    // For multiple-choice: options = ["A. text", "B. text"], correctAnswers = ["A"]
    // For true-false: options = ["a. text", "b. text"], correctAnswers = ["a:true", "b:false"]
    // For short-answer: correctAnswers = ["answer"]
    options: [String],
    correctAnswers: [String],
    score: { type: Number, default: 1 },
    explanation: { type: String },

    // Legacy format (for backward compatibility)
    // quiz (options[{text, isCorrect}] - select 1 correct option)
    legacyOptions: [{
        text: { type: String },
        isCorrect: { type: Boolean }
    }],

    // true-false (trueFalseOptions[{text, isCorrect}] - each option is True or False)
    trueFalseOptions: [{
        text: { type: String },
        isCorrect: { type: Boolean }
    }],

    // short-answer (correctAnswer string, ignore case, ignore '-' and ',')
    correctAnswer: { type: String },
    maxLength: { type: Number },

    // ide (language, starterCode, testCases[{input, expectedOutput}])
    language: { type: String },
    starterCode: { type: String },
    testCases: [{
        input: { type: String },
        expectedOutput: { type: String }
    }]
}, { _id: true });

const exerciseSchema = new mongoose.Schema({
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'KHLesson', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    questions: [questionSchema],
    mustPassToNext: { type: Boolean, default: true }
}, {
    timestamps: true
});

const KHExercise = mongoose.model('KHExercise', exerciseSchema);

module.exports = KHExercise;