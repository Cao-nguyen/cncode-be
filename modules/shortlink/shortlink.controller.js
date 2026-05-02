// modules/shortlink/shortlink.controller.js
const shortlinkService = require('./shortlink.service');

const checkAlias = async (req, res) => {
    try {
        const { alias } = req.params;
        const available = await shortlinkService.isAliasAvailable(alias);
        res.json({ success: true, available });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const createShortLink = async (req, res) => {
    try {
        const { originalUrl, customAlias, expiresInDays } = req.body;
        const userId = req.userId || null;

        const shortLink = await shortlinkService.createShortLink(originalUrl, userId, customAlias, expiresInDays);

        const io = req.app.get('io');
        if (io && userId) {
            io.to(userId.toString()).emit('shortlink_created', {
                shortCode: shortLink.shortCode,
                userId
            });
        }

        res.status(201).json({ success: true, data: shortLink });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const redirectToOriginal = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const originalUrl = await shortlinkService.getOriginalUrl(shortCode);

        if (!originalUrl) {
            return res.status(404).render('error', { message: 'Link không tồn tại hoặc đã hết hạn' });
        }

        res.redirect(originalUrl);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getUserLinks = async (req, res) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await shortlinkService.getUserLinks(userId, page, limit);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAllLinks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';

        const result = await shortlinkService.getAllLinks(page, limit, search);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteShortLink = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const userId = req.userId;
        const isAdmin = req.userRole === 'admin';

        await shortlinkService.deleteShortLink(shortCode, userId, isAdmin);

        const io = req.app.get('io');
        if (io && userId) {
            io.to(userId.toString()).emit('shortlink_deleted', { shortCode, userId });
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
        const { newAlias, expiresInDays } = req.body;

        const updatedLink = await shortlinkService.updateShortLink(shortCode, userId, newAlias, expiresInDays);

        const io = req.app.get('io');
        if (io && userId) {
            io.to(userId.toString()).emit('shortlink_updated', {
                shortCode: updatedLink.shortCode,
                userId,
                oldShortCode: shortCode
            });
        }

        res.json({ success: true, data: updatedLink });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    checkAlias,
    createShortLink,
    redirectToOriginal,
    getUserLinks,
    getAllLinks,
    deleteShortLink,
    updateShortLink
};