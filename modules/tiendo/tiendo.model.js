const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'KHLesson', required: true },
    isCompleted: { type: Boolean, default: false },
    watchedSeconds: { type: Number, default: 0 },
    completedAt: { type: Date }
}, {
    timestamps: true
});

const Progress = mongoose.model('Progress', progressSchema);

module.exports = Progress;