const Statistic = require('./statistic.model');
const SessionRecord = require('./session-record.model');

class StatisticService {
    async trackVisit(sessionId, userId) {
        if (!sessionId) return false;
        const today = new Date().toISOString().split('T')[0];
        const uniqueKey = `${today}_${sessionId}`;

        try {
            const existed = await SessionRecord.findOneAndUpdate(
                { sessionId: uniqueKey },
                { $set: { userId, date: today } },
                { upsert: true, new: false }
            );

            if (existed) return false;

            await Statistic.findOneAndUpdate(
                { date: today },
                { $inc: { todayVisits: 1, totalVisits: 1 } },
                { upsert: true }
            );

            return true;
        } catch (error) {
            return false;
        }
    }

    async getStats() {
        const today = new Date().toISOString().split('T')[0];
        const totalResult = await Statistic.aggregate([
            { $group: { _id: null, total: { $sum: '$todayVisits' } } }
        ]);
        const todayStat = await Statistic.findOne({ date: today });

        return {
            totalVisits: totalResult[0]?.total || 0,
            todayVisits: todayStat?.todayVisits || 0
        };
    }
}

module.exports = new StatisticService();