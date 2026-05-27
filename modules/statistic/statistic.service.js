const Statistic = require('./statistic.model');
const SessionRecord = require('./session-record.model');

class StatisticService {
    async trackVisit(sessionId, userId = null) {
        try {
            const today = new Date().toISOString().split('T')[0];

            const existing = await SessionRecord.findOne({ sessionId, date: today });
            if (existing) return false;

            await SessionRecord.create({ sessionId, date: today, userId });

            let stat = await Statistic.findOne({ date: today });
            if (!stat) {
                stat = new Statistic({ date: today });
            }

            stat.totalVisits += 1;
            stat.todayVisits += 1;
            await stat.save();

            return true;
        } catch (error) {
            console.error('Error tracking visit:', error);
            return false;
        }
    }

    async getStats() {
        try {
            const today = new Date().toISOString().split('T')[0];

            const totalResult = await Statistic.aggregate([
                { $group: { _id: null, total: { $sum: '$todayVisits' } } }
            ]);

            const todayStat = await Statistic.findOne({ date: today });

            return {
                totalVisits: totalResult[0]?.total || 0,
                todayVisits: todayStat?.todayVisits || 0
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return { totalVisits: 0, todayVisits: 0 };
        }
    }

    async incrementVisit(date) {
        try {
            const stat = await Statistic.findOneAndUpdate(
                { date },
                { $inc: { totalVisits: 1, todayVisits: 1 } },
                { upsert: true, new: true }
            );
            return stat;
        } catch (error) {
            console.error('Error incrementing visit:', error);
            return null;
        }
    }
}

module.exports = new StatisticService();
