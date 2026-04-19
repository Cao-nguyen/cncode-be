// modules/statistic/statistic.controller.js
const statisticService = require('./statistic.service');

const trackVisit = async (req, res, next) => {
    try {
        const userId = req.userId || null;
        const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];

        if (!sessionId) {
            return next();
        }

        const pageUrl = req.originalUrl || req.url;
        const referrer = req.headers.referer || 'direct';

        statisticService.trackVisit({
            userId,
            sessionId,
            pageUrl,
            referrer
        }).catch(err => console.error('Track visit error:', err));

        next();
    } catch (error) {
        console.error('Track visit middleware error:', error);
        next();
    }
};

// Lấy thống kê công khai (cho trang chủ)
const getPublicStats = async (req, res) => {
    try {
        const stats = await statisticService.getQuickStats();

        res.status(200).json({
            success: true,
            data: {
                totalVisits: stats.totalVisits,
                todayVisits: stats.todayVisits
            }
        });
    } catch (error) {
        console.error('Get public stats error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Lấy thống kê chi tiết (cho admin)
const getStatistics = async (req, res) => {
    try {
        const statistics = await statisticService.getStatistics();

        res.status(200).json({
            success: true,
            data: statistics
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Lấy danh sách user đang online (cho admin)
const getOnlineUsers = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const onlineUsers = await statisticService.getOnlineUsers(limit);

        res.status(200).json({
            success: true,
            data: onlineUsers
        });
    } catch (error) {
        console.error('Get online users error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Reset thống kê (cho admin)
const resetStatistics = async (req, res) => {
    try {
        const result = await statisticService.resetStatistics();

        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Reset statistics error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    trackVisit,
    getPublicStats,
    getStatistics,
    getOnlineUsers,
    resetStatistics
};