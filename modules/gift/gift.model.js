const mongoose = require('mongoose');

const giftSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  image: {
    type: String,
    required: true
  },
  priceInXu: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['heart', 'star', 'flower', 'special', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

giftSchema.index({ isActive: 1, order: 1 });

const Gift = mongoose.models.Gift || mongoose.model('Gift', giftSchema);

module.exports = { Gift };
