const mongoose = require('mongoose');

const statisticSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true,
        default: () => new Date().toISOString().split('T')[0]
    },
    totalVisits: {
        type: Number,
        default: 0
    },
    uniqueVisitors: {
        type: Number,
        default: 0
    },
    guestVisits: {
        type: Number,
        default: 0
    },
    userVisits: {
        type: Number,
        default: 0
    },
    pageViews: {
        type: Map,
        of: Number,
        default: {}
    },
    referrers: {
        type: Map,
        of: Number,
        default: {}
    }
}, {
    timestamps: true
});

statisticSchema.index({ date: -1 });

module.exports = mongoose.model('Statistic', statisticSchema);