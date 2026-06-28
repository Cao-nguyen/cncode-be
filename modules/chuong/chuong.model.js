const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true },
    order: { type: Number, default: 0 },
    totalLessons: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 }
}, {
    timestamps: true
});

const KHChapter = mongoose.model('KHChapter', chapterSchema);

module.exports = KHChapter;