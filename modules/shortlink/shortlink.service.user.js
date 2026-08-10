const crypto = require('crypto');
const ShortLink = require('./shortlink.model');
const ShortLinkClick = require('./shortlinkClick.model');

function getBaseUrl() {
    return process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
}

const ALIAS_REGEX = /^[a-z0-9_-]+$/;
const MIN_ALIAS = 3;
const MAX_ALIAS = 30;
const CODE_LENGTH = 6;
const MAX_RETRY = 10;

const RESERVED_CODES = new Set([
    'api', 'admin', 'auth', 'login', 'register', 'dashboard',
    's', 'shorten', 'my-links', 'check-alias', 'stats', 'health',
]);

function generateRandomCode() {
    return crypto.randomBytes(CODE_LENGTH).toString('base64url').slice(0, CODE_LENGTH);
}

function validateUrl(url) {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('URL phải bắt đầu bằng http:// hoặc https://');
        }
    } catch {
        throw new Error('URL không hợp lệ');
    }
}

function validateAlias(alias) {
    const trimmed = alias.trim().toLowerCase();
    if (trimmed.length < MIN_ALIAS || trimmed.length > MAX_ALIAS) {
        throw new Error(`Alias phải từ ${MIN_ALIAS} đến ${MAX_ALIAS} ký tự`);
    }
    if (!ALIAS_REGEX.test(trimmed)) {
        throw new Error('Alias chỉ chứa chữ thường, số, dấu gạch dưới và gạch ngang');
    }
    if (RESERVED_CODES.has(trimmed)) {
        throw new Error('Alias này không được phép sử dụng');
    }
    return trimmed;
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

async function generateUniqueCode() {
    for (let i = 0; i < MAX_RETRY; i++) {
        const code = generateRandomCode();
        const exists = await ShortLink.exists({ shortCode: code });
        if (!exists) return code;
    }
    throw new Error('Không thể tạo mã ngắn, vui lòng thử lại');
}

async function isAliasAvailable(alias) {
    const exists = await ShortLink.exists({ shortCode: alias.trim().toLowerCase() });
    return !exists;
}

async function createShortLink(originalUrl, userId = null, customAlias = null, expiresAt = null, clickLimit = null, password = null, geoRestrictVietnam = false) {
    validateUrl(originalUrl);

    let shortCode;
    let isCustom = false;

    if (customAlias) {
        shortCode = validateAlias(customAlias);
        const available = await isAliasAvailable(shortCode);
        if (!available) throw new Error('Alias đã được sử dụng');
        isCustom = true;
    } else {
        shortCode = await generateUniqueCode();
    }

    // Handle expiresAt as ISO string
    let expiresAtDate = null;
    if (expiresAt) {
        expiresAtDate = new Date(expiresAt);
        if (isNaN(expiresAtDate.getTime())) {
            throw new Error('Ngày hết hạn không hợp lệ');
        }
    }

    const shortLink = await ShortLink.create({
        shortCode,
        originalUrl,
        userId,
        isCustom,
        expiresAt: expiresAtDate,
        clickLimit: clickLimit || null,
        password: password || null,
        geoRestrictVietnam,
    });

    return formatLink(shortLink);
}

async function getOriginalUrl(shortCode, password = null, clientIp = null) {
    const link = await ShortLink.findOne({ shortCode: shortCode.toLowerCase() });
    if (!link) return null;
    if (link.expiresAt && link.expiresAt < new Date()) return null;

    // Check click limit
    if (link.clickLimit && link.clicks >= link.clickLimit) {
        return null; // Link has exceeded click limit
    }

    // Check geo restriction (Vietnam only)
    if (link.geoRestrictVietnam && clientIp) {
        // Simple check - in production, use a proper IP geolocation service
        // For now, we'll check if IP is from Vietnam ranges or use a service
        const isVietnam = await checkIpInVietnam(clientIp);
        if (!isVietnam) {
            return { error: 'geo_restricted', shortCode: link.shortCode };
        }
    }

    // Check password
    if (link.password) {
        if (!password) {
            return { error: 'password_required', shortCode: link.shortCode };
        }
        if (password !== link.password) {
            return { error: 'password_invalid', shortCode: link.shortCode };
        }
    }

    await ShortLink.updateOne({ _id: link._id }, { $inc: { clicks: 1 } });

    // Record daily click
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await ShortLinkClick.findOneAndUpdate(
        { shortCode: shortCode.toLowerCase(), clickDate: today },
        { $inc: { clicks: 1 } },
        { upsert: true, new: true }
    );

    // Emit socket event for realtime click update
    const io = global.io;
    if (io && link.userId) {
        io.to(link.userId.toString()).emit('shortlink:clicked', {
            shortCode: link.shortCode,
            clicks: link.clicks + 1
        });
    }

    return {
        originalUrl: link.originalUrl,
        shortCode: link.shortCode,
    };
}

async function checkIpInVietnam(ip) {
    // Simple implementation - in production use proper geolocation service
    // For now, we'll assume all IPs are valid for testing
    // TODO: Implement proper IP geolocation check
    return true;
}

async function getUserLinks(userId, page = 1, limit = 1000) {
    const skip = (page - 1) * limit;
    const [links, total] = await Promise.all([
        ShortLink.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
        ShortLink.countDocuments({ userId }),
    ]);

    return {
        links: links.map(formatLink),
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
}

async function deleteShortLink(shortCode, userId = null) {
    const query = { shortCode: shortCode.toLowerCase(), userId };
    const result = await ShortLink.deleteOne(query);
    if (result.deletedCount === 0) throw new Error('Không tìm thấy link hoặc không có quyền xóa');
}

async function updateShortLink(shortCode, userId, newAlias = null, expiresInDays = undefined, expiresInHours = undefined, expiresInMinutes = undefined) {
    const link = await ShortLink.findOne({ shortCode: shortCode.toLowerCase(), userId });
    if (!link) throw new Error('Không tìm thấy link hoặc không có quyền chỉnh sửa');

    const updateData = {};

    if (newAlias && newAlias.trim() !== shortCode) {
        const validAlias = validateAlias(newAlias);
        const available = await isAliasAvailable(validAlias);
        if (!available) throw new Error('Alias đã được sử dụng');
        updateData.shortCode = validAlias;
        updateData.isCustom = true;
    }

    if (expiresInMinutes !== undefined) {
        updateData.expiresAt = expiresInMinutes && expiresInMinutes > 0
            ? new Date(Date.now() + expiresInMinutes * 60000)
            : null;
    } else if (expiresInHours !== undefined) {
        updateData.expiresAt = expiresInHours && expiresInHours > 0
            ? new Date(Date.now() + expiresInHours * 3600000)
            : null;
    } else if (expiresInDays !== undefined) {
        updateData.expiresAt = expiresInDays && expiresInDays > 0
            ? new Date(Date.now() + expiresInDays * 86400000)
            : null;
    }

    const updated = await ShortLink.findOneAndUpdate(
        { shortCode: link.shortCode, userId },
        updateData,
        { new: true }
    );

    return formatLink(updated);
}

async function getLinkClickStats(shortCode, userId, days = 30) {
    const query = { shortCode: shortCode.toLowerCase() };
    if (userId) {
        query.userId = userId;
    }

    const link = await ShortLink.findOne(query);
    if (!link) throw new Error('Không tìm thấy link hoặc không có quyền xem');

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

async function getUserStats(userId) {
    const [totalLinks, totalClicks, expiredLinks, activeLinks] = await Promise.all([
        ShortLink.countDocuments({ userId }),
        ShortLink.aggregate([
            { $match: { userId } },
            { $group: { _id: null, totalClicks: { $sum: '$clicks' } } }
        ]),
        ShortLink.countDocuments({ 
            userId, 
            expiresAt: { $lt: new Date() } 
        }),
        ShortLink.countDocuments({ 
            userId,
            $or: [
                { expiresAt: null },
                { expiresAt: { $gte: new Date() } }
            ]
        })
    ]);

    return {
        totalLinks,
        totalClicks: totalClicks[0]?.totalClicks || 0,
        expiredLinks,
        activeLinks
    };
}

module.exports = {
    isAliasAvailable,
    createShortLink,
    getOriginalUrl,
    getUserLinks,
    deleteShortLink,
    updateShortLink,
    getLinkClickStats,
    checkIpInVietnam,
    getUserStats,
};
