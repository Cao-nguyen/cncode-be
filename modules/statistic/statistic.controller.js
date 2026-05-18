const statisticService = require('./statistic.service');
const analyticsService = require('../../services/analytics.service');

// Middleware đếm view khi user load trang web
const trackVisit = async (req, res, next) => {
    try {
        const sessionId = req.sessionId;
        const userId = req.userId || null;

        if (sessionId && !req.originalUrl.includes('/api/')) {
            await statisticService.trackVisit(sessionId, userId);
        }
    } catch (error) {
        console.error('Lỗi tracking visit:', error);
    } finally {
        next();
    }
};

// API lấy tổng lượt truy cập từ DB
const getPublicStats = async (req, res) => {
    try {
        const stats = await statisticService.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi khi lấy thống kê' });
    }
};

// API lấy số người đang online trực tiếp từ RAM (qua Analytics Service)
const getOnlineStats = (req, res) => {
    try {
        const stats = analyticsService.getOnlineStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi lấy số liệu online' });
    }
};

module.exports = { trackVisit, getPublicStats, getOnlineStats };