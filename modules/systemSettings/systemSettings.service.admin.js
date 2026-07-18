const SystemSettings = require('./systemSettings.model');

class SystemSettingsServiceAdmin {
    async getSettings() {
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = await SystemSettings.create({});
        }
        return settings;
    }

    async updateField(field, value, userId) {
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = await SystemSettings.create({});
        }

        const oldValue = settings[field];
        
        // Add to history
        settings.updateHistory.push({
            field,
            oldValue,
            newValue: value,
            updatedBy: userId,
            updatedAt: new Date()
        });

        settings[field] = value;
        settings.updatedBy = userId;
        await settings.save();

        return settings;
    }

    async getHistory(field) {
        const settings = await SystemSettings.findOne();
        if (!settings) return [];

        if (field) {
            return settings.updateHistory.filter(h => h.field === field);
        }
        return settings.updateHistory;
    }
}

module.exports = new SystemSettingsServiceAdmin();
