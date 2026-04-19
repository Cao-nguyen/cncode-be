const mongoose = require('mongoose');

const sessionRecordSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    date: { type: String, required: true }
});

sessionRecordSchema.index({ sessionId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('SessionRecord', sessionRecordSchema);