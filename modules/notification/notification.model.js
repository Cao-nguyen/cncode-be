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
            'first_login_bonus',   // 100 xu khi đăng nhập lần đầu
            'streak_bonus',        // thưởng streak
            'system'
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
    // Metadata cho bonus coins/streak
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

// Index để query nhanh
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);