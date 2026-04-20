const ShortLink = require('./shortlink.model');

const generateSlug = (length = 6) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const createShortLink = async (originalUrl, customSlug, userId = null, expiresInDays = null) => {
    let slug = customSlug && customSlug.trim() ? customSlug.trim() : generateSlug();

    let existing = await ShortLink.findOne({ slug });
    let retryCount = 0;
    while (existing && retryCount < 5) {
        slug = generateSlug();
        existing = await ShortLink.findOne({ slug });
        retryCount++;
    }

    if (existing) {
        throw new Error('Không thể tạo slug, vui lòng thử lại');
    }

    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const shortLink = new ShortLink({ originalUrl, slug, userId, expiresAt });
    await shortLink.save();
    return shortLink;
};

const getOriginalUrl = async (slug) => {
    const shortLink = await ShortLink.findOne({ slug });
    if (!shortLink) {
        throw new Error('Link không tồn tại');
    }

    if (shortLink.expiresAt && shortLink.expiresAt < new Date()) {
        throw new Error('Link đã hết hạn');
    }

    shortLink.clicks += 1;
    await shortLink.save();
    return shortLink.originalUrl;
};

const getUserLinks = async (userId) => {
    return await ShortLink.find({ userId }).sort({ createdAt: -1 });
};

const deleteLink = async (slug, userId) => {
    const link = await ShortLink.findOne({ slug, userId });
    if (!link) throw new Error('Không tìm thấy link');
    await link.deleteOne();
    return link;
};

module.exports = { createShortLink, getOriginalUrl, getUserLinks, deleteLink, generateSlug };