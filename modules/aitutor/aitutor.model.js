const mongoose = require('mongoose');

const aiChatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    attachments: [{
      type: {
        type: String,
        enum: ['image', 'file'], // 'file' giữ cho tin nhắn cũ
      },
      name: String,
      url: String,
      messageId: String,
    }],
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  title: {
    type: String,
    default: 'Cuộc trò chuyện mới'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isPinned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index để query nhanh
aiChatSchema.index({ userId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('AIChat', aiChatSchema);
