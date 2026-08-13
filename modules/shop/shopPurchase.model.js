const mongoose = require('mongoose');

const shopPurchaseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    amount: {
        type: Number,
        default: 0,
    },
    paymentMethod: {
        type: String,
        enum: ['free', 'coin', 'payos'],
        default: 'coin',
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed',
    },
    orderCode: {
        type: Number,
    },
    purchasedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

shopPurchaseSchema.index({ userId: 1, productId: 1 }, { unique: true });
shopPurchaseSchema.index({ sellerId: 1, createdAt: -1 });

const ShopPurchase = mongoose.model('ShopPurchase', shopPurchaseSchema);

module.exports = ShopPurchase;
