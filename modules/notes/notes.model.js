const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: true,
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    time: {
        type: Number,
        required: true,
    },
    timeStr: {
        type: String,
        required: true,
    },
    text: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
});

// Index for faster queries
noteSchema.index({ userId: 1, lessonId: 1 });

module.exports = mongoose.model('Note', noteSchema);
