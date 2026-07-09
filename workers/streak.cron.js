'use strict';

const cron = require('node-cron');
const User = require('../modules/user/user.model');

/**
 * Reset streak for users who haven't completed it today at 00:00
 */
const resetStreakJob = async () => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find all users whose lastStreakDate is before today
        const usersToReset = await User.find({
            lastStreakDate: { $lt: today },
            streak: { $gt: 0 }
        });

        if (usersToReset.length === 0) {
            console.log('[Streak Cron] No users to reset');
            return;
        }

        // Reset streak to 0 for all matching users
        const updatePromises = usersToReset.map(user => {
            user.streak = 0;
            return user.save();
        });

        await Promise.all(updatePromises);

        console.log(`[Streak Cron] Reset streak for ${usersToReset.length} users`);

        // Emit socket events to update frontend
        const io = global.io;
        if (io) {
            usersToReset.forEach(user => {
                io.to(user._id.toString()).emit('streak_updated', {
                    userId: user._id.toString(),
                    streak: 0,
                    totalCoins: user.coins
                });
            });
        }
    } catch (error) {
        console.error('[Streak Cron] Error:', error);
    }
};

// Run streak reset job at 00:00 every day
cron.schedule('0 0 * * *', resetStreakJob, {
    timezone: 'Asia/Bangkok'
});

console.log('[Streak Cron] Job scheduled at 00:00 (Asia/Bangkok timezone)');

module.exports = { resetStreakJob };