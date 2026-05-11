// modules/voucher/voucher.model.js
const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountValue: { type: Number, required: true, min: 0 },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed', 'freeship'],
        required: true
    },
    category: { type: String, default: 'Khóa học', trim: true },
    minOrder: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, min: 0 },
    expiryDate: { type: Date, required: true },
    usageLimit: { type: Number, default: 100, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isGlobal: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['active', 'inactive', 'expired'],
        default: 'active'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Indexes
voucherSchema.index({ code: 1 });
voucherSchema.index({ status: 1 });
voucherSchema.index({ expiryDate: 1 });
voucherSchema.index({ isGlobal: 1 });

// Auto update status based on expiry date
voucherSchema.pre('save', function (next) {
    if (this.expiryDate && new Date(this.expiryDate) < new Date()) {
        this.status = 'expired';
    }
    next();
});

module.exports = mongoose.model('Voucher', voucherSchema);