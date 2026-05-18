const Statistic = require('./statistic.model');
const SessionRecord = require('./session-record.model');

class StatisticService {
    async trackVisit(sessionId, userId) {
        const today = new Date().toISOString().split('T')[0];

        // Nếu session này đã truy cập hôm nay rồi thì bỏ qua (không đếm thêm)
        const existed = await SessionRecord.findOne({ sessionId, date: today });
        if (existed) return false;

        // Lưu session vào DB
        await SessionRecord.create({ sessionId, date: today });

        // Cập nhật số liệu thống kê
        let stat = await Statistic.findOne({ date: today });
        if (!stat) {
            stat = new Statistic({ date: today });
        }

        stat.totalVisits += 1;
        stat.todayVisits += 1;
        await stat.save();

        return true;
    }

    async getStats() {
        const today = new Date().toISOString().split('T')[0];

        // Tính tổng tất cả các lượt truy cập từ trước tới nay
        const total = await Statistic.aggregate([{ $group: { _id: null, total: { $sum: '$todayVisits' } } }]);
        const todayStat = await Statistic.findOne({ date: today });

        return {
            totalVisits: total[0]?.total || 0,
            todayVisits: todayStat?.todayVisits || 0
        };
    }
}

module.exports = new StatisticService();