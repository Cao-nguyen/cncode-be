const { RutGonLink } = require('./rutgonlink.model');

async function getShortLinkByCode(shortCode) {
    const shortLink = await RutGonLink.findOne({ shortCode });

    if (!shortLink) {
        throw new Error('Không tìm thấy link rút gọn');
    }

    // Check if link is active
    if (!shortLink.isActive) {
        throw new Error('Link rút gọn đã bị vô hiệu hóa');
    }

    // Check if link has expired
    if (shortLink.expiresAt && new Date(shortLink.expiresAt) < new Date()) {
        throw new Error('Link rút gọn đã hết hạn');
    }

    // Increment click count
    shortLink.clickCount += 1;
    await shortLink.save();

    return shortLink;
}

async function getUserShortLinks(userId, page = 1, limit = 20, search = null) {
    const skip = (page - 1) * limit;

    const query = { createdBy: userId };
    if (search) {
        query.$or = [
            { originalUrl: { $regex: search, $options: 'i' } },
            { shortCode: { $regex: search, $options: 'i' } }
        ];
    }

    const shortLinks = await RutGonLink.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await RutGonLink.countDocuments(query);

    return {
        data: shortLinks,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

async function createUserShortLink(userId, originalUrl, shortCode, expiresAt) {
    // Check if shortCode already exists
    const existingLink = await RutGonLink.findOne({ shortCode });
    if (existingLink) {
        throw new Error('Mã rút gọn đã tồn tại');
    }

    const shortLink = await RutGonLink.create({
        originalUrl,
        shortCode,
        expiresAt,
        createdBy: userId
    });

    return shortLink;
}

async function updateUserShortLink(userId, linkId, originalUrl, shortCode, expiresAt, isActive) {
    // Check if link belongs to user
    const shortLink = await RutGonLink.findOne({ _id: linkId, createdBy: userId });
    if (!shortLink) {
        throw new Error('Không tìm thấy link rút gọn hoặc bạn không có quyền sửa');
    }

    // Check if shortCode already exists (excluding current document)
    if (shortCode) {
        const existingLink = await RutGonLink.findOne({ shortCode, _id: { $ne: linkId } });
        if (existingLink) {
            throw new Error('Mã rút gọn đã tồn tại');
        }
    }

    shortLink.originalUrl = originalUrl || shortLink.originalUrl;
    shortLink.shortCode = shortCode || shortLink.shortCode;
    shortLink.expiresAt = expiresAt !== undefined ? expiresAt : shortLink.expiresAt;
    shortLink.isActive = isActive !== undefined ? isActive : shortLink.isActive;

    await shortLink.save();

    return shortLink;
}

async function deleteUserShortLink(userId, linkId) {
    const shortLink = await RutGonLink.findOneAndDelete({ _id: linkId, createdBy: userId });

    if (!shortLink) {
        throw new Error('Không tìm thấy link rút gọn hoặc bạn không có quyền xóa');
    }

    return shortLink;
}

module.exports = {
    getShortLinkByCode,
    getUserShortLinks,
    createUserShortLink,
    updateUserShortLink,
    deleteUserShortLink
};
