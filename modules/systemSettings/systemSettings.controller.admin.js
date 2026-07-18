const systemSettingsService = require('./systemSettings.service.admin');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

module.exports = {
    async getSettings(req, res) {
        try {
            const settings = await systemSettingsService.getSettings();
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Get settings error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async updateGioiThieu(req, res) {
        try {
            const { content } = req.body;
            const settings = await systemSettingsService.updateField('gioiThieu', content, req.userId);
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Update gioiThieu error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async updateDieuKhoanSuDung(req, res) {
        try {
            const { content } = req.body;
            const settings = await systemSettingsService.updateField('dieuKhoanSuDung', content, req.userId);
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Update dieuKhoanSuDung error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async updateAnToanBaoMat(req, res) {
        try {
            const { content } = req.body;
            const settings = await systemSettingsService.updateField('anToanBaoMat', content, req.userId);
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Update anToanBaoMat error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async updateQuyTrinhSuDung(req, res) {
        try {
            const { content } = req.body;
            const settings = await systemSettingsService.updateField('quyTrinhSuDung', content, req.userId);
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Update quyTrinhSuDung error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async updateHuongDanThanhToan(req, res) {
        try {
            const { content } = req.body;
            const settings = await systemSettingsService.updateField('huongDanThanhToan', content, req.userId);
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Update huongDanThanhToan error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async updateChinhSachBaoHanh(req, res) {
        try {
            const { content } = req.body;
            const settings = await systemSettingsService.updateField('chinhSachBaoHanh', content, req.userId);
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Update chinhSachBaoHanh error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async getHistory(req, res) {
        try {
            const { field } = req.query;
            const history = await systemSettingsService.getHistory(field);
            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            console.error('Get history error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};
