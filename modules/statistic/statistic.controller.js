const statisticService = require('./statistic.service');
const analyticsService = require('../../services/analytics.service');

const getPublicStats = async (req, res) => {
    try {
        const [stats, weekly] = await Promise.all([
            statisticService.getStats(),
            statisticService.getWeeklyStats(),
        ]);

        return res.json({
            success: true,
            data: {
                ...stats,
                weeklyData: weekly.weeklyData,
                thisWeek: weekly.thisWeek,
            },
        });
    } catch (error) {
        console.error('GetPublicStats Error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi lấy thống kê' });
    }
};

const getWeeklyStats = async (req, res) => {
    try {
        const weekly = await statisticService.getWeeklyStats();
        return res.json({ success: true, data: weekly });
    } catch (error) {
        console.error('GetWeeklyStats Error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi lấy thống kê tuần' });
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

const getOnlineGuests = (req, res) => {
    try {
        const guests = analyticsService.getOnlineGuestsList();
        return res.json({ success: true, data: guests });
    } catch (error) {
        console.error('GetOnlineGuests Error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

const trackVisitEndpoint = async (req, res) => {
    try {
        const { sessionId, userId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ success: false, message: 'SessionId is required' });
        }

        const tracked = await statisticService.trackVisit(sessionId, userId || null);

        return res.json({
            success: true,
            tracked,
            message: tracked ? 'Visit tracked' : 'Already tracked today'
        });
    } catch (error) {
        console.error('TrackVisit Error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = { getPublicStats, getWeeklyStats, getOnlineStats, getOnlineGuests, trackVisitEndpoint };
