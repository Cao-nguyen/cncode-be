const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'KHChapter', required: true },
    title: { type: String, required: true },
    order: { type: Number, default: 0 },
    type: { type: String, enum: ['video', 'exercise'], default: 'video' },
    videoFileId: { type: String },
    duration: { type: Number, default: 0 },
    description: { type: String },
    quizMarkdown: { type: String, default: '' },
    quizQuestions: [{
        time: { type: Number, default: 0 },
        type: { type: String, default: 'multiple-choice' },
        question: { type: String },
        options: [{ type: String }],
        correctAnswer: { type: Number, default: 0 },
        correctAnswers: [{ type: String }],
        score: { type: Number, default: 1 },
        explanation: { type: String },
        leftItems: [{ type: String }],
        rightItems: [{ type: String }],
        matchingPairs: [{ left: String, right: String }],
        codeMode: { type: String },
        language: { type: String },
        testCases: [{ type: mongoose.Schema.Types.Mixed }],
        algoRequirement: { type: String },
        algoInputDesc: { type: String },
        algoOutputDesc: { type: String },
        webRequirements: [{ type: mongoose.Schema.Types.Mixed }],
    }],
    isPreview: { type: Boolean, default: false }
}, {
    timestamps: true
});

const KHLesson = mongoose.model('KHLesson', lessonSchema);

module.exports = KHLesson;