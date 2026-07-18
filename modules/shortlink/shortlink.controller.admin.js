const service = require('./shortlink.service.admin');
const User = require('../user/user.model');

const getAllLinks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';

        const result = await service.getAllLinks(page, limit, search);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Get all links error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getStats = async (req, res) => {
    try {
        const stats = await service.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getLinkClickStats = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const days = parseInt(req.query.days) || 30;
        const stats = await service.getLinkClickStats(shortCode, days);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get link click stats error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteShortLink = async (req, res) => {
    try {
        const { shortCode } = req.params;

        await service.deleteShortLink(shortCode);

        const io = req.app.get('io');
        if (io) {
            const admins = await User.find({ role: 'admin' }).select('_id');
            admins.forEach(admin => {
                io.to(admin._id.toString()).emit('shortlink:deleted_by_admin', { shortCode });
            });
        }

        res.json({ success: true, message: 'Xóa link thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllLinks,
    getStats,
    getLinkClickStats,
    deleteShortLink,
};
