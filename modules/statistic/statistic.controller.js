const statisticService = require('./statistic.service');
const analyticsService = require('../../services/analytics.service');

const trackVisit = async (req, res, next) => {
    try {
        const sessionId = req.sessionId;
        const userId = req.userId || null;
        if (sessionId && !req.originalUrl.includes('/api/')) {
            await statisticService.trackVisit(sessionId, userId);
        }
    } catch (error) {
        console.error('TrackVisit Error:', error);
    } finally {
        next();
    }
};

const getPublicStats = async (req, res) => {
    try {
        const stats = await statisticService.getStats();
        return res.json({ success: true, data: stats });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi lấy thống kê' });
    }
};

const getOnlineStats = (req, res) => {
    try {
        const stats = analyticsService.getOnlineStats();
        return res.json(stats);
    } catch (error) {
        console.error('GetOnlineStats Error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = { trackVisit, getPublicStats, getOnlineStats };