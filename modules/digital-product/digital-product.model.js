const mongoose = require('mongoose')

const digitalProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  longDescription: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['powerpoint', 'code', 'design', 'document'],
    required: true
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  enableXuPayment: {
    type: Boolean,
    default: true
  },
  priceInXu: {
    type: Number,
    default: 0
  },
  thumbnail: {
    type: String,
    required: true
  },
  previewImages: [{
    type: String
  }],
  downloadUrl: {
    type: String,
    required: true
  },
  previewUrl: {
    type: String
  },
  features: [{
    type: String
  }],
  requirements: [{
    type: String
  }],
  tags: [{
    type: String
  }],
  downloadCount: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

digitalProductSchema.pre('save', function(next) {
  this.updatedAt = Date.now()
  next()
})

module.exports = mongoose.model('DigitalProduct', digitalProductSchema)