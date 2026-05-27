
const Setting = require('./setting.model');

class PublicSettingController {
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

    async getMultipleSettings(req, res) {
        try {
            const { keys } = req.query;
            const keyArray = keys ? keys.split(',') : [];
            const settings = await Setting.find({ key: { $in: keyArray } });

            const settingsMap = {};
            settings.forEach(s => {
                settingsMap[s.key] = s.value;
            });

            res.json({
                success: true,
                data: settingsMap
            });
        } catch (error) {
            console.error('Get multiple settings error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new PublicSettingController();
