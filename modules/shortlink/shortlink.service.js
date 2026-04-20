const ShortLink = require('./shortlink.model');

const createShortLink = async (originalUrl, slug, userId = null) => {
    const existing = await ShortLink.findOne({ slug });
    if (existing) {
        throw new Error('Slug này đã được sử dụng');
    }

    const shortLink = new ShortLink({ originalUrl, slug, userId });
    await shortLink.save();
    return shortLink;
};

const getOriginalUrl = async (slug) => {
    const shortLink = await ShortLink.findOne({ slug });
    if (!shortLink) {
        throw new Error('Link không tồn tại');
    }
    shortLink.clicks += 1;
    await shortLink.save();
    return shortLink.originalUrl;
};

module.exports = { createShortLink, getOriginalUrl };