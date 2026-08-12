'use strict';

const cron = require('node-cron');
const shortlinkCleanupService = require('../services/shortlinkCleanup.service');

// Xóa link hết hạn lúc 07:00 mỗi ngày (giờ Việt Nam)
cron.schedule('0 7 * * *', () => {
    void shortlinkCleanupService.runSafe('daily-cron');
}, {
    timezone: 'Asia/Bangkok',
});

console.log('[Shortlink Cron] Scheduled daily at 07:00 (Asia/Bangkok — giờ Việt Nam)');

module.exports = shortlinkCleanupService;
