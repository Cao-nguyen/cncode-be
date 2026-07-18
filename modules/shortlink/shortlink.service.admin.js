const ShortLink = require('./shortlink.model');
const ShortLinkClick = require('./shortlinkClick.model');

function getBaseUrl() {
    return process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
}

function formatLink(link) {
    return {
        shortCode: link.shortCode,
        shortUrl: `${getBaseUrl()}/s/${link.shortCode}`,
        originalUrl: link.originalUrl,
        isCustom: link.isCustom,
        clicks: link.clicks,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
    };
}

async function getAllLinks(page = 1, limit = 50, search = '') {
    const skip = (page - 1) * limit;
    const query = search
        ? {
            $or: [
                { shortCode: { $regex: search, $options: 'i' } },
                { originalUrl: { $regex: search, $options: 'i' } },
            ],
        }
        : {};

    const [links, total] = await Promise.all([
        ShortLink.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'fullName email username avatarUrl'),
        ShortLink.countDocuments(query),
    ]);

    return {
        links: links.map((link) => ({
            ...formatLink(link),
            user: link.userId
                ? {
                    id: link.userId._id,
                    fullName: link.userId.fullName,
                    email: link.userId.email,
                    username: link.userId.username,
                    avatarUrl: link.userId.avatarUrl,
                }
                : null,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
}

async function getStats() {
    const [totalLinks, totalClicks, activeLinks, expiredLinks, customLinks, recentClicks, topLinks] = await Promise.all([
        ShortLink.countDocuments(),
        ShortLink.aggregate([{ $group: { _id: null, total: { $sum: '$clicks' } } }]),
        ShortLink.countDocuments({
            $or: [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ]
        }),
        ShortLink.countDocuments({ expiresAt: { $lt: new Date(), $ne: null } }),
        ShortLink.countDocuments({ isCustom: true }),
        ShortLink.aggregate([
            { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, clicks: { $sum: '$clicks' } } },
            { $sort: { _id: 1 } }
        ]),
        ShortLink.aggregate([
            { $sort: { clicks: -1 } },
            { $limit: 5 },
            { $project: { shortCode: 1, originalUrl: 1, clicks: 1 } }
        ])
    ]);

    return {
        totalLinks,
        totalClicks: totalClicks[0]?.total || 0,
        activeLinks,
        expiredLinks,
        customLinks,
        recentClicks: recentClicks.map(item => ({
            date: item._id,
            clicks: item.clicks,
        })),
        topLinks: topLinks.map(link => ({
            shortCode: link.shortCode,
            originalUrl: link.originalUrl,
            clicks: link.clicks,
        })),
    };
}

async function deleteShortLink(shortCode) {
    const query = { shortCode: shortCode.toLowerCase() };
    const result = await ShortLink.deleteOne(query);
    if (result.deletedCount === 0) throw new Error('Không tìm thấy link');
    
    // Also delete click statistics
    await ShortLinkClick.deleteMany({ shortCode: shortCode.toLowerCase() });
}

async function getLinkClickStats(shortCode, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const stats = await ShortLinkClick.find({
        shortCode: shortCode.toLowerCase(),
        clickDate: { $gte: startDate }
    }).sort({ clickDate: 1 });

    return stats.map(stat => ({
        date: stat.clickDate.toISOString().split('T')[0],
        clicks: stat.clicks
    }));
}

module.exports = {
    getAllLinks,
    getStats,
    deleteShortLink,
    getLinkClickStats,
};
