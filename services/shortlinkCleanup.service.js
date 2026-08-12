'use strict';

const ShortLink = require('../modules/shortlink/shortlink.model');
const ShortLinkClick = require('../modules/shortlink/shortlinkClick.model');

const RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

function getRetentionCutoff(now = new Date()) {
    return new Date(now.getTime() - RETENTION_MS);
}

function buildExpiredDeleteQuery(cutoff) {
    return {
        $or: [
            { expiresAt: { $ne: null, $lte: cutoff } },
            { expiredAt: { $ne: null, $lte: cutoff } },
        ],
    };
}

async function markClickLimitExpiredLinks(now = new Date()) {
    const links = await ShortLink.find({
        expiredAt: null,
        clickLimit: { $ne: null },
        $expr: { $gte: ['$clicks', '$clickLimit'] },
    }).select('_id shortCode createdAt');

    if (!links.length) return 0;

    let marked = 0;
    for (const link of links) {
        const lastClick = await ShortLinkClick.findOne({ shortCode: link.shortCode })
            .sort({ clickDate: -1 })
            .select('clickDate');

        const expiredAt = lastClick?.clickDate || link.createdAt || now;
        await ShortLink.updateOne(
            { _id: link._id, expiredAt: null },
            { $set: { expiredAt } },
        );
        marked += 1;
    }

    return marked;
}

async function deleteExpiredLinks() {
    const now = new Date();
    const cutoff = getRetentionCutoff(now);

    const marked = await markClickLimitExpiredLinks(now);

    const expiredLinks = await ShortLink.find(buildExpiredDeleteQuery(cutoff))
        .select('_id shortCode userId');

    if (!expiredLinks.length) {
        if (marked > 0) {
            console.log(`[Shortlink Cleanup] Marked ${marked} click-limit expired links`);
        } else {
            console.log('[Shortlink Cleanup] No expired links to delete');
        }
        return { deletedLinks: 0, deletedClicks: 0, markedClickLimit: marked };
    }

    const shortCodes = expiredLinks.map((link) => link.shortCode);

    const [deleteResult, clickDeleteResult] = await Promise.all([
        ShortLink.deleteMany({ shortCode: { $in: shortCodes } }),
        ShortLinkClick.deleteMany({ shortCode: { $in: shortCodes } }),
    ]);

    console.log(
        `[Shortlink Cleanup] Deleted ${deleteResult.deletedCount} expired links`
        + ` and ${clickDeleteResult.deletedCount} click records`
        + (marked > 0 ? `; marked ${marked} click-limit links` : ''),
    );

    const io = global.io;
    if (io) {
        const userIds = [...new Set(expiredLinks.map((link) => link.userId).filter(Boolean))];
        userIds.forEach((userId) => {
            io.to(userId.toString()).emit('shortlink:expired_deleted', {
                deletedCount: deleteResult.deletedCount,
            });
        });
    }

    return {
        deletedLinks: deleteResult.deletedCount,
        deletedClicks: clickDeleteResult.deletedCount,
        markedClickLimit: marked,
    };
}

class ShortlinkCleanupService {
    constructor() {
        this.running = false;
    }

    start() {
        console.log('[Shortlink Cleanup] Retention 2 ngày — xóa lúc 07:00 giờ Việt Nam (Asia/Bangkok)');
    }

    stop() {
        console.log('[Shortlink Cleanup] Service stopped');
    }

    async runSafe(trigger = 'manual') {
        if (this.running) {
            console.log(`[Shortlink Cleanup] Skip ${trigger} run — previous job still running`);
            return null;
        }

        this.running = true;
        try {
            return await deleteExpiredLinks();
        } catch (error) {
            console.error(`[Shortlink Cleanup] Error during ${trigger} run:`, error);
            return null;
        } finally {
            this.running = false;
        }
    }
}

module.exports = new ShortlinkCleanupService();
module.exports.deleteExpiredLinks = deleteExpiredLinks;
module.exports.getRetentionCutoff = getRetentionCutoff;
