// modules/voucher/userVoucher.model.js
const mongoose = require('mongoose');

const userVoucherSchema = new mongoose.Schema({
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    code: { type: String, required: true },
    status: {
        type: String,
        enum: ['available', 'used', 'expired'],
        default: 'available'
    },
    usedAt: { type: Date },
    assignedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

// Indexes
userVoucherSchema.index({ userId: 1, status: 1 });
userVoucherSchema.index({ code: 1 });
userVoucherSchema.index({ expiresAt: 1 });
userVoucherSchema.index({ voucherId: 1, userId: 1 }, { unique: true });

// Auto update expired status
userVoucherSchema.pre('save', function (next) {
    if (this.expiresAt && new Date(this.expiresAt) < new Date() && this.status === 'available') {
        this.status = 'expired';
    }
    next();
});

module.exports = mongoose.model('UserVoucher', userVoucherSchema);