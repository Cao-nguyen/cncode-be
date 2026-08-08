const { RutGonLink } = require('./rutgonlink.model');
const crypto = require('crypto');

// Generate API Key for user
function generateApiKey() {
    return 'cn_' + crypto.randomBytes(32).toString('hex');
}

// Get user's links via API key
async function getUserLinksViaApiKey(userId, page = 1, limit = 20, search = null) {
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
        success: true,
        data: shortLinks,
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
                const existingLink = await RutGonLink.findOne({ shortCode: customAlias });
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
            const shortCode = customAlias || generateApiKey().substring(3, 10);

            // Create short link
            const shortLink = await RutGonLink.create({
                originalUrl,
                shortCode,
                expiresAt,
                createdBy: userId
            });

            results.push({
                originalUrl,
                shortCode,
                shortUrl: `${process.env.BASE_URL || 'https://cncode.io.vn'}/rutgonlink/${shortCode}`,
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
