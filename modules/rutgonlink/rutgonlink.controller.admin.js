const {
    getAllShortLinks,
    getShortLinkById,
    createShortLink,
    updateShortLink,
    deleteShortLink,
    getStats
} = require('./rutgonlink.services.admin');

const getAllShortLinksHandler = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, isActive } = req.query;
        const result = await getAllShortLinks(parseInt(page), parseInt(limit), search, isActive);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Get all short links error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getShortLinkByIdHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const shortLink = await getShortLinkById(id);
        res.json({ success: true, data: shortLink });
    } catch (error) {
        console.error('Get short link by ID error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy link rút gọn' });
    }
};

const createShortLinkHandler = async (req, res) => {
    try {
        const userId = req.userId;
        const { originalUrl, shortCode, expiresAt } = req.body;
        const shortLink = await createShortLink(userId, originalUrl, shortCode, expiresAt);
        res.status(201).json({ success: true, data: shortLink, message: 'Tạo link rút gọn thành công' });
    } catch (error) {
        console.error('Create short link error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const updateShortLinkHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const { originalUrl, shortCode, expiresAt, isActive } = req.body;
        const shortLink = await updateShortLink(id, originalUrl, shortCode, expiresAt, isActive);
        res.json({ success: true, data: shortLink, message: 'Cập nhật link rút gọn thành công' });
    } catch (error) {
        console.error('Update short link error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const deleteShortLinkHandler = async (req, res) => {
    try {
        const { id } = req.params;
        await deleteShortLink(id);
        res.json({ success: true, message: 'Xóa link rút gọn thành công' });
    } catch (error) {
        console.error('Delete short link error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getStatsHandler = async (req, res) => {
    try {
        const stats = await getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

module.exports = {
    getAllShortLinks: getAllShortLinksHandler,
    getShortLinkById: getShortLinkByIdHandler,
    createShortLink: createShortLinkHandler,
    updateShortLink: updateShortLinkHandler,
    deleteShortLink: deleteShortLinkHandler,
    getStats: getStatsHandler
};
