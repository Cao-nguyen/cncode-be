const mongoose = require('mongoose');

// Collection cho broadcast notifications (1 document cho tất cả users)
const broadcastNotificationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['policy_update', 'system_announcement', 'maintenance'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    meta: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    targetAudience: {
        type: String,
        enum: ['all', 'users_only', 'teachers_only'],
        default: 'all'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

// TTL: Tự động xóa sau 15 ngày
broadcastNotificationSchema.index(
    { createdAt: 1 },
    {
        expireAfterSeconds: 15 * 24 * 60 * 60,
        name: 'createdAt_ttl_15days'
    }
);

// Index cho query
broadcastNotificationSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('BroadcastNotification', broadcastNotificationSchema);