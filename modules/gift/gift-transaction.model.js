const mongoose = require('mongoose');

const giftTransactionSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gift',
    required: true
  },
  targetType: {
    type: String,
    enum: ['user', 'post'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  message: {
    type: String,
    trim: true,
    maxlength: 200
  },
  coinsSpent: {
    type: Number,
    required: true
  },
  xuReceived: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

giftTransactionSchema.index({ sender: 1, createdAt: -1 });
giftTransactionSchema.index({ recipient: 1, createdAt: -1 });
giftTransactionSchema.index({ targetType: 1, targetId: 1 });

const GiftTransaction = mongoose.models.GiftTransaction || mongoose.model('GiftTransaction', giftTransactionSchema);

module.exports = { GiftTransaction };
