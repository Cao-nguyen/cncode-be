const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    paymentMethod: { type: String, enum: ['payos', 'coin', 'free'], default: 'free' },
    paymentStatus: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    orderCode: { type: Number, unique: true, sparse: true },
    enrolledAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

module.exports = Enrollment;