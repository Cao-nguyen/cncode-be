
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'teacher', 'admin'],
    default: 'user'
  },
  teacherName: {
    type: String,
    default: ''
  },
  teacherWorkUnit: {
    type: String,
    default: ''
  },
  requestedRole: {
    type: String,
    enum: ['teacher', null],
    default: null
  },
  class: {
    type: String,
    default: ''
  },
  province: {
    type: String,
    default: ''
  },
  school: {
    type: String,
    default: ''
  },
  birthday: {
    type: Date,
    default: null
  },
  bio: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  socialLinks: [{
    label: { type: String, required: true },
    url: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  coins: {
    type: Number,
    default: 0
  },
  streak: {
    type: Number,
    default: 0
  },
  lastStreakDate: {
    type: Date,
    default: null
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  isOnboarded: {
    type: Boolean,
    default: false
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  isMuted: {
    type: Boolean,
    default: false
  },
  bannedAt: {
    type: Date
  },
  banReason: {
    type: String
  },
  mutedUntil: {
    type: Date
  },
  violations: [{
    reason: String,
    action: String,
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
