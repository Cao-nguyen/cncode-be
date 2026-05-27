
const Setting = require('./setting.model');

class SettingController {
    async getSettings(req, res) {
        try {
            const settings = await Setting.find().lean();
            const settingsMap = {};
            settings.forEach(s => {
                settingsMap[s.key] = s.value;
            });

            res.json({
                success: true,
                data: settingsMap
            });
        } catch (error) {
            console.error('Get settings error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getSettingByKey(req, res) {
        try {
            const { key } = req.params;
            const setting = await Setting.findOne({ key });

            res.json({
                success: true,
                data: setting ? setting.value : ''
            });
        } catch (error) {
            console.error('Get setting error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async updateSetting(req, res) {
        try {
            const { key } = req.params;
            const { value, type = 'html' } = req.body;
            const userId = req.userId;

            const setting = await Setting.findOneAndUpdate(
                { key },
                { value, type, updatedBy: userId },
                { upsert: true, new: true }
            );

            res.json({
                success: true,
                message: 'Cập nhật thành công',
                data: setting
            });
        } catch (error) {
            console.error('Update setting error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new SettingController();
