const mongoose = require('mongoose');

const coinTransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['credit', 'debit'], required: true }, // credit: +, debit: -
    amount: { type: Number, required: true },
    reason: { type: String, required: true }, // Ví dụ: "Đăng ký khóa học", "Giới thiệu bạn bè", "Tham gia cuộc thi"
    relatedId: { type: mongoose.Schema.Types.ObjectId }, // ID liên quan (courseId, affiliateId, contestId, v.v.)
    relatedType: { type: String }, // Loại liên quan (course, affiliate, contest, v.v.)
    balanceAfter: { type: Number, required: true }, // Số xu sau giao dịch
}, {
    timestamps: true
});

const CoinTransaction = mongoose.model('CoinTransaction', coinTransactionSchema);

module.exports = CoinTransaction;
