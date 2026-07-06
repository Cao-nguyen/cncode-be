const mongoose = require('mongoose');

const chatWithAdminSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderRole: {
      type: String,
      enum: ['user', 'admin'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    read: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  unreadCount: {
    type: Number,
    default: 0
  },
  userUnreadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for sorting by unread and lastMessageAt
chatWithAdminSchema.index({ unreadCount: -1, lastMessageAt: -1 });

module.exports = mongoose.model('ChatWithAdmin', chatWithAdminSchema);
