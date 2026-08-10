'use strict';

const cron = require('node-cron');
const ShortLink = require('../modules/shortlink/shortlink.model');
const ShortLinkClick = require('../modules/shortlink/shortlinkClick.model');

/**
 * Delete expired shortlinks that have been expired for more than 3 days
 * Runs daily at 02:00 AM (Asia/Bangkok timezone)
 */
const deleteExpiredLinksJob = async () => {
    try {
        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

        // Find expired links that have been expired for more than 3 days
        const expiredLinks = await ShortLink.find({
            expiresAt: { $lt: threeDaysAgo }
        });

        if (expiredLinks.length === 0) {
            console.log('[Shortlink Cron] No expired links to delete');
            return;
        }

        // Get all shortCodes to delete
        const shortCodes = expiredLinks.map(link => link.shortCode);

        // Delete the links
        const deleteResult = await ShortLink.deleteMany({
            shortCode: { $in: shortCodes }
        });

        // Delete associated click statistics
        const clickDeleteResult = await ShortLinkClick.deleteMany({
            shortCode: { $in: shortCodes }
        });

        console.log(`[Shortlink Cron] Deleted ${deleteResult.deletedCount} expired links and ${clickDeleteResult.deletedCount} click records`);

        // Emit socket events to update frontend for affected users
        const io = global.io;
        if (io) {
            const userIds = [...new Set(expiredLinks.map(link => link.userId).filter(id => id))];
            userIds.forEach(userId => {
                io.to(userId.toString()).emit('shortlink:expired_deleted', {
                    deletedCount: deleteResult.deletedCount
                });
            });
        }
    } catch (error) {
        console.error('[Shortlink Cron] Error:', error);
    }
};

// Run delete expired links job at 02:00 every day
cron.schedule('0 2 * * *', deleteExpiredLinksJob, {
    timezone: 'Asia/Bangkok'
});

console.log('[Shortlink Cron] Job scheduled at 02:00 (Asia/Bangkok timezone)');

module.exports = { deleteExpiredLinksJob };
