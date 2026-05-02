const crypto = require('crypto');
const ShortLink = require('./shortlink.model');

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
    's', 'shorten', 'my-links', 'check-alias',
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

async function createShortLink(originalUrl, userId = null, customAlias = null, expiresInDays = null) {
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

    const expiresAt = expiresInDays && expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 86_400_000)
        : null;

    const shortLink = await ShortLink.create({
        shortCode,
        originalUrl,
        userId,
        isCustom,
        expiresAt,
    });

    return formatLink(shortLink);
}

async function getOriginalUrl(shortCode) {
    const link = await ShortLink.findOne({ shortCode: shortCode.toLowerCase() });
    if (!link) return null;
    if (link.expiresAt && link.expiresAt < new Date()) return null;

    await ShortLink.updateOne({ _id: link._id }, { $inc: { clicks: 1 } });
    return link.originalUrl;
}

async function getUserLinks(userId, page = 1, limit = 20) {
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
            .populate('userId', 'fullName email username'),
        ShortLink.countDocuments(query),
    ]);

    return {
        links: links.map((link) => ({
            ...formatLink(link),
            user: link.userId
                ? {
                    id: link.userId._id,
                    name: link.userId.fullName,
                    email: link.userId.email,
                    username: link.userId.username
                }
                : null,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
}

async function deleteShortLink(shortCode, userId = null, isAdmin = false) {
    const query = { shortCode: shortCode.toLowerCase() };
    if (!isAdmin) query.userId = userId;
    const result = await ShortLink.deleteOne(query);
    if (result.deletedCount === 0) throw new Error('Không tìm thấy link hoặc không có quyền xóa');
}

async function updateShortLink(shortCode, userId, newAlias = null, expiresInDays = undefined) {
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

    if (expiresInDays !== undefined) {
        updateData.expiresAt = expiresInDays && expiresInDays > 0
            ? new Date(Date.now() + expiresInDays * 86_400_000)
            : null;
    }

    const updated = await ShortLink.findOneAndUpdate(
        { shortCode: link.shortCode, userId },
        updateData,
        { new: true }
    );

    return formatLink(updated);
}

module.exports = {
    isAliasAvailable,
    createShortLink,
    getOriginalUrl,
    getUserLinks,
    getAllLinks,
    deleteShortLink,
    updateShortLink
};