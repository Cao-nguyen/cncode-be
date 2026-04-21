// modules/system-settings/system-settings.service.js
const SystemSettings = require('./system-settings.model');

class SystemSettingsService {
    // Lấy settings (nếu chưa có thì tạo mới)
    async getSettings() {
        let settings = await SystemSettings.findOne()
            .populate('createdBy', 'fullName email avatar')
            .populate('updatedBy', 'fullName email avatar')
            .populate('updateHistory.updatedBy', 'fullName email avatar')
            .lean();

        if (!settings) {
            settings = await SystemSettings.create({});
        }

        return settings;
    }

    // Cập nhật từng field riêng
    async updateField(field, content, userId) {
        const settings = await SystemSettings.findOne();
        if (!settings) {
            const newSettings = await SystemSettings.create({
                [field]: content,
                createdBy: userId,
                updatedBy: userId
            });
            return newSettings;
        }

        const oldValue = settings[field];

        // Lưu lịch sử
        settings.updateHistory.push({
            field,
            oldValue: oldValue || '',
            newValue: content,
            updatedBy: userId,
            updatedAt: new Date()
        });

        // Giới hạn lịch sử 50 bản ghi
        if (settings.updateHistory.length > 50) {
            settings.updateHistory = settings.updateHistory.slice(-50);
        }

        settings[field] = content;
        settings.updatedBy = userId;
        settings.updatedAt = new Date();

        await settings.save();

        return settings;
    }

    // Lấy nội dung theo field (public)
    async getContentByField(field) {
        const settings = await SystemSettings.findOne().lean();
        if (!settings) return '';
        return settings[field] || '';
    }

    // Lấy lịch sử cập nhật của một field
    async getFieldHistory(field) {
        const settings = await SystemSettings.findOne()
            .populate('updateHistory.updatedBy', 'fullName email avatar')
            .lean();

        if (!settings) return [];

        return settings.updateHistory
            .filter(h => h.field === field)
            .reverse();
    }
}

module.exports = new SystemSettingsService();