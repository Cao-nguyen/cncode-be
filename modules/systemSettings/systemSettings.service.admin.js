const { SystemSettings } = require('./systemSettings.model');
const { slugToField, VALID_FIELDS } = require('./systemSettings.constants');

async function getOrCreateSettings() {
    let settings = await SystemSettings.findOne();
    if (!settings) {
        settings = await SystemSettings.create({});
    }
    return settings;
}

async function getSettings() {
    return getOrCreateSettings();
}

async function updateField(field, value, userId) {
    if (!VALID_FIELDS.includes(field)) {
        throw new Error('Trường cài đặt không hợp lệ');
    }

    const settings = await getOrCreateSettings();
    const oldValue = settings[field];

    settings.updateHistory.push({
        field,
        oldValue,
        newValue: value,
        updatedBy: userId,
        updatedAt: new Date(),
    });

    settings[field] = value;
    settings.updatedBy = userId;
    await settings.save();

    return settings;
}

async function updateFieldBySlug(slug, value, userId) {
    const field = slugToField(slug);
    if (!field) {
        throw new Error('Trường cài đặt không hợp lệ');
    }
    return updateField(field, value, userId);
}

async function getHistory(field) {
    const settings = await SystemSettings.findOne();
    if (!settings) return [];

    if (field) {
        return settings.updateHistory.filter((item) => item.field === field);
    }

    return settings.updateHistory;
}

module.exports = {
    getSettings,
    updateField,
    updateFieldBySlug,
    getHistory,
};
