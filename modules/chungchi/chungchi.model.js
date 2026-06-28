const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    fullName: { type: String, required: true },
    imageUrl: { type: String }, // URL to PNG certificate image
    issuedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const Certificate = mongoose.model('Certificate', certificateSchema);

module.exports = Certificate;