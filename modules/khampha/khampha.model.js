const mongoose = require('mongoose');

const khamphaSchema = new mongoose.Schema({
  videoUrl: {
    type: String,
    required: [true, 'URL video là bắt buộc'],
  },
  // FileId từ EncryptedFile để stream video
  fileId: {
    type: String,
    index: true,
  },
  thumbnailUrl: {
    type: String,
  },
  caption: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  music: {
    title: String,
    artist: String,
    coverUrl: String,
  },
  hashtags: [{
    type: String,
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  location: {
    type: String,
    trim: true,
  },
  // Engagement metrics
  likeCount: {
    type: Number,
    default: 0,
  },
  commentCount: {
    type: Number,
    default: 0,
  },
  shareCount: {
    type: Number,
    default: 0,
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  favoriteCount: {
    type: Number,
    default: 0,
  },
  // User interactions
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  // Privacy and moderation
  isPrivate: {
    type: Boolean,
    default: false,
  },
  isReported: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  deleteReason: {
    type: String,
  },
  // Video settings
  duration: {
    type: Number,
    default: 0,
  },
  allowComments: {
    type: Boolean,
    default: true,
  },
  allowDuet: {
    type: Boolean,
    default: true,
  },
  allowStitch: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true
});

// Virtual để lấy streaming URL nếu có fileId
khamphaSchema.virtual('streamUrl').get(function () {
  if (this.fileId) {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    return `${backendUrl}/api/test-up/stream/video/${this.fileId}`;
  }
  return this.videoUrl; // Fallback về Telegram URL
});

// Ensure virtuals are included in JSON
khamphaSchema.set('toJSON', { virtuals: true });
khamphaSchema.set('toObject', { virtuals: true });

// Indexes for better query performance
khamphaSchema.index({ author: 1, createdAt: -1 });
khamphaSchema.index({ createdAt: -1 });
khamphaSchema.index({ likeCount: -1 });
khamphaSchema.index({ viewCount: -1 });
khamphaSchema.index({ isDeleted: 1, isReported: 1 });
khamphaSchema.index({ hashtags: 1 });

const Khampha = mongoose.models.Khampha || mongoose.model('Khampha', khamphaSchema);

module.exports = { Khampha };
