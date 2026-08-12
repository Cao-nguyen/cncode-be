const service = require('./systemSettings.service.user');

const getPublicContent = async (req, res) => {
    try {
        const content = await service.getPublicContent(req.params.slug);
        res.json({ success: true, data: content });
    } catch (error) {
        console.error('Get public content error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy nội dung' });
    }
};

module.exports = {
    getPublicContent,
};
