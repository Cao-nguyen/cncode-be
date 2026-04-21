// modules/dashboard/dashboard.model.js
const mongoose = require('mongoose');

const dashboardStatsSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true
    },
    stats: {
        totalUsers: { type: Number, default: 0 },
        newUsers: { type: Number, default: 0 },
        totalProducts: { type: Number, default: 0 },
        totalOrders: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
        totalPosts: { type: Number, default: 0 },
        totalViews: { type: Number, default: 0 },
        activeUsers: { type: Number, default: 0 }
    }
}, { timestamps: true });

module.exports = mongoose.model('DashboardStats', dashboardStatsSchema);