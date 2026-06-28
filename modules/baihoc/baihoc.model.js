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
    quizQuestions: [{
        time: { type: Number, default: 0 },
        question: { type: String },
        options: [{ type: String }],
        correctAnswer: { type: Number, default: 0 }
    }],
    isPreview: { type: Boolean, default: false }
}, {
    timestamps: true
});

const KHLesson = mongoose.model('KHLesson', lessonSchema);

module.exports = KHLesson;