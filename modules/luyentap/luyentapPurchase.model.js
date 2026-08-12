const mongoose = require('mongoose');

const practiceExercisePurchaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeExercise', required: true, index: true },
    paymentMethod: { type: String, enum: ['payos', 'coin', 'free'], default: 'payos' },
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    orderCode: { type: Number },
    amount: { type: Number, default: 0 },
    purchasedAt: { type: Date },
}, { timestamps: true });

practiceExercisePurchaseSchema.index({ userId: 1, exerciseId: 1 });

const PracticeExercisePurchase = mongoose.model('PracticeExercisePurchase', practiceExercisePurchaseSchema);

module.exports = PracticeExercisePurchase;
