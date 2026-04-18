const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  fullName: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: ''
  },
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['user', 'teacher', 'admin'],
    default: 'user'
  },
  isOnboarded: {
    type: Boolean,
    default: false
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
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: '',
    maxlength: 500
  },
  coins: {
    type: Number,
    default: 100
  },
  streak: {
    type: Number,
    default: 0
  },
  lastActiveAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('User', userSchema)