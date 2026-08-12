const service = require('./systemSettings.service.admin');

const getSettings = async (req, res) => {
    try {
        const settings = await service.getSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy cài đặt' });
    }
};

const updateSetting = async (req, res) => {
    try {
        const { content } = req.body;
        if (content === undefined) {
            return res.status(400).json({ success: false, message: 'Thiếu nội dung cài đặt' });
        }

        const settings = await service.updateFieldBySlug(req.params.field, content, req.userId);
        res.json({
            success: true,
            data: settings,
            message: 'Cập nhật cài đặt thành công',
        });
    } catch (error) {
        console.error('Update setting error:', error);
        const status = error.message.includes('không hợp lệ') ? 400 : 500;
        res.status(status).json({ success: false, message: error.message || 'Lỗi khi cập nhật cài đặt' });
    }
};

const getHistory = async (req, res) => {
    try {
        const history = await service.getHistory(req.query.field);
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy lịch sử' });
    }
};

module.exports = {
    getSettings,
    updateSetting,
    getHistory,
};
