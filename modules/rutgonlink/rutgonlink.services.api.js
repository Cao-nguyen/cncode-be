const crypto = require('crypto');
const ShortLink = require('../shortlink/shortlink.model');

// Generate API Key for user
function generateApiKey() {
    return 'cn_' + crypto.randomBytes(32).toString('hex');
}

// Get user's links via API key
async function getUserLinksViaApiKey(userId, page = 1, limit = 20, search = null) {
    const skip = (page - 1) * limit;

    const query = { userId };
    if (search) {
        query.$or = [
            { originalUrl: { $regex: search, $options: 'i' } },
            { shortCode: { $regex: search, $options: 'i' } }
        ];
    }

    const shortLinks = await ShortLink.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await ShortLink.countDocuments(query);

    return {
        success: true,
        data: shortLinks.map(link => ({
            shortCode: link.shortCode,
            shortUrl: `${process.env.BASE_URL || 'https://cncode.io.vn'}/s/${link.shortCode}`,
            originalUrl: link.originalUrl,
            clicks: link.clicks,
            expiresAt: link.expiresAt,
            createdAt: link.createdAt,
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

// Batch create short links from external API
async function batchCreateShortLinks(userId, links, expiresInHours) {
    const results = [];
    const errors = [];

    for (const linkData of links) {
        try {
            const { originalUrl, customAlias } = linkData;

            // Validate URL
            if (!originalUrl) {
                errors.push({
                    url: originalUrl,
                    error: 'URL is required'
                });
                continue;
            }

            // Check if custom alias already exists
            if (customAlias) {
                const existingLink = await ShortLink.findOne({ shortCode: customAlias.toLowerCase() });
                if (existingLink) {
                    errors.push({
                        url: originalUrl,
                        error: 'Custom alias already exists'
                    });
                    continue;
                }
            }

            // Calculate expiry time
            let expiresAt = null;
            if (expiresInHours && expiresInHours > 0) {
                const expiryDate = new Date();
                expiryDate.setHours(expiryDate.getHours() + expiresInHours);
                expiresAt = expiryDate.toISOString();
            }

            // Generate short code if not provided
            let shortCode = customAlias;
            if (!shortCode) {
                // Generate random code
                shortCode = crypto.randomBytes(6).toString('base64url').slice(0, 6);
                
                // Ensure uniqueness
                let retry = 0;
                while (await ShortLink.exists({ shortCode }) && retry < 10) {
                    shortCode = crypto.randomBytes(6).toString('base64url').slice(0, 6);
                    retry++;
                }
            }

            // Create short link
            const shortLink = await ShortLink.create({
                originalUrl,
                shortCode: shortCode.toLowerCase(),
                expiresAt,
                userId,
                isCustom: !!customAlias
            });

            results.push({
                originalUrl,
                shortCode: shortLink.shortCode,
                shortUrl: `${process.env.BASE_URL || 'https://cncode.io.vn'}/s/${shortLink.shortCode}`,
                expiresAt
            });
        } catch (error) {
            errors.push({
                url: linkData.originalUrl,
                error: error.message
            });
        }
    }

    return {
        success: true,
        created: results.length,
        failed: errors.length,
        results,
        errors
    };
}

module.exports = {
    generateApiKey,
    batchCreateShortLinks,
    getUserLinksViaApiKey
};
