const Statistic = require('./statistic.model');
const SessionRecord = require('./session-record.model');

class StatisticService {
    async trackVisit(sessionId, userId) {
        const today = new Date().toISOString().split('T')[0];

        const existed = await SessionRecord.findOne({ sessionId, date: today });
        if (existed) return false;

        await SessionRecord.create({ sessionId, date: today });

        let stat = await Statistic.findOne({ date: today });
        if (!stat) stat = new Statistic({ date: today });

        stat.totalVisits += 1;
        stat.todayVisits += 1;
        await stat.save();

        return true;
    }

    async getStats() {
        const today = new Date().toISOString().split('T')[0];
        const total = await Statistic.aggregate([{ $group: { _id: null, total: { $sum: '$totalVisits' } } }]);
        const todayStat = await Statistic.findOne({ date: today });

        return {
            totalVisits: total[0]?.total || 0,
            todayVisits: todayStat?.todayVisits || 0
        };
    }
}

module.exports = new StatisticService();