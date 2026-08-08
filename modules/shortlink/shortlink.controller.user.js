const service = require('./shortlink.service.user');

const checkAlias = async (req, res) => {
    try {
        const { alias } = req.params;
        const available = await service.isAliasAvailable(alias);
        res.json({ success: true, available });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const createShortLink = async (req, res) => {
    try {
        const { originalUrl, customAlias, expiresInDays, expiresInHours, expiresInMinutes } = req.body;
        const userId = req.userId || null;

        const shortLink = await service.createShortLink(originalUrl, userId, customAlias, expiresInDays, expiresInHours, expiresInMinutes);

        const io = req.app.get('io');
        if (io && userId) {
            io.to(userId.toString()).emit('shortlink:created', shortLink);
        }

        res.status(201).json({ success: true, data: shortLink });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const redirectToOriginal = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const result = await service.getOriginalUrl(shortCode);

        if (!result) {
            return res.redirect(307, '/link-expired');
        }

        // Redirect to interstitial page with shortCode and originalUrl
        const frontendUrl = process.env.FRONTEND_URL || 'https://cncode.io.vn';
        const redirectUrl = `${frontendUrl}/rutgonlink/redirect?code=${shortCode}&url=${encodeURIComponent(result.originalUrl)}`;
        
        res.redirect(307, redirectUrl);
    } catch (error) {
        console.error('Redirect error:', error);
        res.status(500).send('Internal server error');
    }
};

const getUserLinks = async (req, res) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await service.getUserLinks(userId, page, limit);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteShortLink = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const userId = req.userId;

        await service.deleteShortLink(shortCode, userId);

        const io = req.app.get('io');
        if (io && userId) {
            io.to(userId.toString()).emit('shortlink:deleted', { shortCode });
        }

        res.json({ success: true, message: 'Xóa link thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateShortLink = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const userId = req.userId;
        const { newAlias, expiresInDays, expiresInHours, expiresInMinutes } = req.body;

        const updatedLink = await service.updateShortLink(shortCode, userId, newAlias, expiresInDays, expiresInHours, expiresInMinutes);

        const io = req.app.get('io');
        if (io && userId) {
            io.to(userId.toString()).emit('shortlink:updated', updatedLink);
        }

        res.json({ success: true, data: updatedLink });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getLinkClickStats = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const userId = req.userId;
        const days = parseInt(req.query.days) || 30;
        const stats = await service.getLinkClickStats(shortCode, userId, days);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get link click stats error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    checkAlias,
    createShortLink,
    redirectToOriginal,
    getUserLinks,
    deleteShortLink,
    updateShortLink,
    getLinkClickStats,
};
