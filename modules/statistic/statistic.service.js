// modules/statistic/statistic.service.js
const mongoose = require('mongoose');
const Statistic = require('./statistic.model');
const StatisticSession = require('./session-record.model');

class StatisticService {
    // Ghi nhận truy cập - CHỈ TÍNH KHI CÓ KẾT NỐI MỚI
    async trackVisit({ userId, sessionId, pageUrl, referrer }) {
        const today = new Date().toISOString().split('T')[0];

        // Kiểm tra xem session đã có kết nối trong 15 giây qua chưa
        const isNewConnection = await this.isNewConnection(sessionId);

        if (isNewConnection) {
            // Cập nhật thống kê
            let statistic = await Statistic.findOne({ date: today });

            if (!statistic) {
                statistic = new Statistic({ date: today });
            }

            // Tăng tổng lượt truy cập
            statistic.totalVisits += 1;

            // Phân loại guest/user
            if (userId) {
                statistic.userVisits += 1;
            } else {
                statistic.guestVisits += 1;
            }

            // Cập nhật unique visitors
            statistic.uniqueVisitors += 1;

            // Cập nhật page views
            if (pageUrl) {
                const currentCount = statistic.pageViews.get(pageUrl) || 0;
                statistic.pageViews.set(pageUrl, currentCount + 1);
            }

            // Cập nhật referrers
            if (referrer && referrer !== 'direct') {
                const currentCount = statistic.referrers.get(referrer) || 0;
                statistic.referrers.set(referrer, currentCount + 1);
            }

            await statistic.save();

            // Đánh dấu session đã kết nối
            await this.markConnectionRecorded(sessionId);
        }

        return true;
    }

    // Kiểm tra có phải kết nối mới không (trong 15 giây)
    async isNewConnection(sessionId) {
        const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000);

        const recentConnection = await StatisticSession.findOne({
            sessionId,
            createdAt: { $gte: fifteenSecondsAgo }
        });

        return !recentConnection;
    }

    // Đánh dấu đã ghi nhận kết nối
    async markConnectionRecorded(sessionId) {
        await StatisticSession.create({ sessionId, date: new Date().toISOString().split('T')[0] });
    }

    // Lấy thống kê nhanh
    async getQuickStats() {
        const today = new Date().toISOString().split('T')[0];

        // Tổng lượt truy cập
        const totalVisitsResult = await Statistic.aggregate([
            { $group: { _id: null, total: { $sum: '$totalVisits' } } }
        ]);
        const totalVisits = totalVisitsResult[0]?.total || 0;

        // Lượt truy cập hôm nay
        const todayStat = await Statistic.findOne({ date: today });
        const todayVisits = todayStat?.totalVisits || 0;

        return {
            totalVisits,
            todayVisits
        };
    }

    // Reset thống kê
    async resetStatistics() {
        await Statistic.deleteMany({});
        await StatisticSession.deleteMany({});
        return { message: 'Đã reset toàn bộ thống kê' };
    }
}

module.exports = new StatisticService();