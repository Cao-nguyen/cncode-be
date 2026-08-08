const { RutGonLink } = require('./rutgonlink.model');

async function getAllShortLinks(page = 1, limit = 20, search = null, isActive = null) {
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
        query.$or = [
            { originalUrl: { $regex: search, $options: 'i' } },
            { shortCode: { $regex: search, $options: 'i' } }
        ];
    }
    if (isActive !== undefined) {
        query.isActive = isActive === 'true';
    }

    const shortLinks = await RutGonLink.find(query)
        .populate('createdBy', '_id fullName email avatar username')
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

async function getShortLinkById(id) {
    const shortLink = await RutGonLink.findById(id)
        .populate('createdBy', '_id fullName email avatar username');

    if (!shortLink) {
        throw new Error('Không tìm thấy link rút gọn');
    }

    return shortLink;
}

async function createShortLink(userId, originalUrl, shortCode, expiresAt) {
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

    const populated = await RutGonLink.findById(shortLink._id)
        .populate('createdBy', '_id fullName email avatar username');

    return populated;
}

async function updateShortLink(id, originalUrl, shortCode, expiresAt, isActive) {
    // Check if shortCode already exists (excluding current document)
    if (shortCode) {
        const existingLink = await RutGonLink.findOne({ shortCode, _id: { $ne: id } });
        if (existingLink) {
            throw new Error('Mã rút gọn đã tồn tại');
        }
    }

    const shortLink = await RutGonLink.findByIdAndUpdate(
        id,
        { originalUrl, shortCode, expiresAt, isActive },
        { new: true, runValidators: true }
    ).populate('createdBy', '_id fullName email avatar username');

    if (!shortLink) {
        throw new Error('Không tìm thấy link rút gọn');
    }

    return shortLink;
}

async function deleteShortLink(id) {
    const shortLink = await RutGonLink.findByIdAndDelete(id);

    if (!shortLink) {
        throw new Error('Không tìm thấy link rút gọn');
    }

    return shortLink;
}

async function getStats() {
    const totalLinks = await RutGonLink.countDocuments();
    const activeLinks = await RutGonLink.countDocuments({ isActive: true });
    const totalClicks = await RutGonLink.aggregate([
        { $group: { _id: null, total: { $sum: '$clickCount' } } }
    ]);

    return {
        totalLinks,
        activeLinks,
        totalClicks: totalClicks[0]?.total || 0
    };
}

module.exports = {
    getAllShortLinks,
    getShortLinkById,
    createShortLink,
    updateShortLink,
    deleteShortLink,
    getStats
};
