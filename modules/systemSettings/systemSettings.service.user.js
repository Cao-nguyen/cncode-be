const { SystemSettings } = require('./systemSettings.model');
const { slugToField, FIELD_TITLE_MAP } = require('./systemSettings.constants');

async function getPublicContent(slug) {
    const field = slugToField(slug);
    if (!field) {
        return {
            title: '',
            content: '',
            slug,
        };
    }

    const settings = await SystemSettings.findOne();
    if (!settings) {
        return {
            title: FIELD_TITLE_MAP[slug] || '',
            content: '',
            slug,
        };
    }

    return {
        title: FIELD_TITLE_MAP[slug] || '',
        content: settings[field] || '',
        slug,
    };
}

module.exports = {
    getPublicContent,
};
