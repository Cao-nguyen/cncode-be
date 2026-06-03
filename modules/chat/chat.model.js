const mongoose = require('mongoose');

// Schema cho Conversation (nhóm chat hoặc chat 1-1)
const conversationSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['private', 'group'],
        required: true,
        default: 'private'
    },
    avatar: {
        type: String,
        default: null
    },
    description: {
        type: String,
        trim: true
    },
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'member'],
            default: 'member'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        lastReadAt: {
            type: Date,
            default: Date.now
        },
        clearHistoryAt: {
            type: Date,
            default: null
        }
    }],
    lastMessage: {
        content: String,
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        sentAt: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    pinnedBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        pinnedAt: {
            type: Date,
            default: Date.now
        }
    }],
    hiddenBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        hiddenAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Index để tìm kiếm nhanh
conversationSchema.index({ 'participants.userId': 1 });
conversationSchema.index({ type: 1, isActive: 1 });
conversationSchema.index({ updatedAt: -1 });

// Schema cho Message
const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['text', 'image', 'file', 'system', 'sticker', 'poll', 'reminder'],
        default: 'text'
    },
    // Reminder data
    reminder: {
        title: String,
        scheduledTime: Date,
        isTriggered: {
            type: Boolean,
            default: false
        },
        triggeredAt: Date
    },
    attachments: [{
        url: String,
        type: String,
        name: String,
        size: Number
    }],
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },
    readBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Index để query nhanh
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ isDeleted: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { Conversation, Message };