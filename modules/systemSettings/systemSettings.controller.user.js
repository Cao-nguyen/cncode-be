const systemSettingsService = require('./systemSettings.service.user');

module.exports = {
    async getPublicContent(req, res) {
        try {
            const { slug } = req.params;
            const content = await systemSettingsService.getPublicContent(slug);
            res.json({
                success: true,
                data: content
            });
        } catch (error) {
            console.error('Get public content error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};
