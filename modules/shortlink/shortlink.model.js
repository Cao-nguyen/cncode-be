const mongoose = require('mongoose');

const shortLinkSchema = new mongoose.Schema({
    originalUrl: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    clicks: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ShortLink', shortLinkSchema);