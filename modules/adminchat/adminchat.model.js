const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
    url: { type: String },
    fileType: { type: String },
    name: { type: String },
    size: { type: Number }
}, { _id: false });

const adminChatConversationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // 1 user chỉ có 1 conversation với admin
    },
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
    assignedAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

adminChatConversationSchema.index({ userId: 1 });
adminChatConversationSchema.index({ updatedAt: -1 });

const adminChatMessageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminChatConversation',
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        trim: true,
        default: ''
    },
    type: {
        type: String,
        enum: ['text', 'image', 'system'],
        default: 'text'
    },
    attachments: [attachmentSchema],
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    isDelivered: {
        type: Boolean,
        default: false
    },
    deliveredAt: {
        type: Date,
        default: null
    },
    isHearted: {
        type: Boolean,
        default: false
    },
    heartedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    autoDeleteAt: {
        type: Date,
        default: null,
        expires: 0 // TTL index will auto-delete when this date is reached
    }
}, {
    timestamps: true
});

adminChatMessageSchema.index({ conversationId: 1, createdAt: 1 });
adminChatMessageSchema.index({ isDeleted: 1 });
adminChatMessageSchema.index({ autoDeleteAt: 1 });

// Set autoDeleteAt to 10 days from now on creation
adminChatMessageSchema.pre('save', function (next) {
    if (this.isNew && !this.autoDeleteAt) {
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
        this.autoDeleteAt = tenDaysFromNow;
    }
    next();
});

const AdminChatConversation = mongoose.model('AdminChatConversation', adminChatConversationSchema);
const AdminChatMessage = mongoose.model('AdminChatMessage', adminChatMessageSchema);

module.exports = { AdminChatConversation, AdminChatMessage };