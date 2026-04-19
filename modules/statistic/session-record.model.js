// modules/statistic/session-record.model.js
const mongoose = require('mongoose');

const sessionRecordSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true
    },
    date: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Index để tự động xóa sau 1 ngày
sessionRecordSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('StatisticSession', sessionRecordSchema);