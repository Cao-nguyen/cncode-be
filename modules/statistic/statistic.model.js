const mongoose = require('mongoose');

const statisticSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true },
    totalVisits: { type: Number, default: 0 },
    todayVisits: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Statistic', statisticSchema);