const mongoose = require('mongoose');

const sessionRecordSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    date: { type: String, required: true }
});

// Đảm bảo 1 session chỉ được đếm 1 lần trong 1 ngày
sessionRecordSchema.index({ sessionId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('SessionRecord', sessionRecordSchema);