const mongoose = require('mongoose');

const exerciseOptionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false }
}, { _id: false });

const exerciseTestCaseSchema = new mongoose.Schema({
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true }
}, { _id: false });

const exerciseQuestionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['quiz', 'true-false', 'short-answer', 'ide'],
        required: true
    },
    question: { type: String, required: true },

    // Quiz options (multiple choice - single correct answer)
    options: [exerciseOptionSchema],

    // True/False options (multiple statements - each can be true/false)
    trueFalseOptions: [exerciseOptionSchema],

    // Short answer
    correctAnswer: { type: String },
    maxLength: { type: Number, default: 100 },

    // IDE coding challenge
    language: { type: String },
    starterCode: { type: String },
    testCases: [exerciseTestCaseSchema]
}, { _id: false });

const exerciseSchema = new mongoose.Schema({
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KHLesson',
        required: true,
        unique: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    questions: [exerciseQuestionSchema],
    mustPassToNext: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Index for quick lookup
exerciseSchema.index({ lessonId: 1 });
exerciseSchema.index({ courseId: 1 });

const KHExercise = mongoose.models.KHExercise || mongoose.model('KHExercise', exerciseSchema);

module.exports = KHExercise;
