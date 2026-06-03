const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    notificationId: {
        type: String,
        unique: true,
        default: () => new mongoose.Types.ObjectId().toString()
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    type: {
        type: String,
        enum: [
            'comment',
            'reply_comment',
            'like_post',
            'reaction_comment',
            'bookmark',
            'first_login_bonus',
            'streak_bonus',
            'system',
            'role_request_rejected',
            'role_request_approved',
            'policy_update',
            'faq_new_question',
            'faq_new_answer',
            'faq_question_liked',
            'faq_answer_liked'
        ],
        required: true
    },
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        default: null
    },
    postSlug: { type: String, default: null },
    postTitle: { type: String, default: null },
    commentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null
    },
    reactionType: { type: String, default: null },
    content: { type: String, default: '' },

    meta: {
        coins: { type: Number, default: 0 },
        streak: { type: Number, default: 0 }
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

// ========================================
// TTL (Time To Live) Index
// ========================================
// Tự động xóa notifications sau 15 ngày để tiết kiệm database
// MongoDB sẽ tự động xóa documents có createdAt cũ hơn 15 ngày
// Background process chạy mỗi 60 giây
// 
// Lợi ích:
// - Tiết kiệm dung lượng database (với 10k users, mỗi broadcast tạo 10k docs)
// - Tự động cleanup, không cần cron job
// - Performance tốt hơn khi query (ít documents hơn)
//
// Lưu ý:
// - Chỉ áp dụng cho notifications, không ảnh hưởng collections khác
// - Sau khi thay đổi expireAfterSeconds, cần restart app hoặc chạy script
notificationSchema.index(
    { createdAt: 1 },
    {
        expireAfterSeconds: 15 * 24 * 60 * 60, // 15 ngày = 1,296,000 giây
        name: 'createdAt_ttl_15days'
    }
);

module.exports = mongoose.model('Notification', notificationSchema);
