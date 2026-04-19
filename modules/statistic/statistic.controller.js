const statisticService = require('./statistic.service');

const trackVisit = async (req, res, next) => {
    const sessionId = req.sessionId;
    const userId = req.userId || null;

    if (sessionId && !req.originalUrl.includes('/api/')) {
        await statisticService.trackVisit(sessionId, userId);
    }
    next();
};

const getPublicStats = async (req, res) => {
    const stats = await statisticService.getStats();
    res.json({ success: true, data: stats });
};

module.exports = { trackVisit, getPublicStats };