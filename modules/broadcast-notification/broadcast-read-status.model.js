const mongoose = require('mongoose');

// Collection nhỏ chỉ lưu trạng thái đã đọc
const broadcastReadStatusSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    broadcastId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BroadcastNotification',
        required: true
    },
    readAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
});

// Composite unique index: 1 user chỉ đọc 1 broadcast 1 lần
broadcastReadStatusSchema.index(
    { userId: 1, broadcastId: 1 },
    { unique: true }
);

// TTL: Tự động xóa sau 15 ngày (cùng với broadcast notification)
broadcastReadStatusSchema.index(
    { readAt: 1 },
    {
        expireAfterSeconds: 15 * 24 * 60 * 60,
        name: 'readAt_ttl_15days'
    }
);

module.exports = mongoose.model('BroadcastReadStatus', broadcastReadStatusSchema);