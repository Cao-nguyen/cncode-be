const mongoose = require('mongoose');

const shortLinkClickSchema = new mongoose.Schema({
    shortCode: {
        type: String,
        required: true,
        index: true,
    },
    clickDate: {
        type: Date,
        required: true,
        index: true,
    },
    clicks: {
        type: Number,
        default: 0,
        min: 0,
    },
}, {
    timestamps: false,
});

shortLinkClickSchema.index({ shortCode: 1, clickDate: 1 }, { unique: true });

module.exports = mongoose.model('ShortLinkClick', shortLinkClickSchema);
