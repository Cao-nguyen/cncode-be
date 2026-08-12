const Statistic = require('./statistic.model');
const SessionRecord = require('./session-record.model');
const { getVnDateString, shiftVnDateString, formatVnChartLabel } = require('../../utils/date');

class StatisticService {
    async trackVisit(sessionId, userId = null) {
        try {
            const today = getVnDateString();

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
            const today = getVnDateString();

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

    async getWeeklyStats() {
        try {
            const today = getVnDateString();
            const dates = [];

            for (let i = 6; i >= 0; i--) {
                dates.push(shiftVnDateString(today, -i));
            }

            const stats = await Statistic.find({ date: { $in: dates } }).lean();
            const statsMap = Object.fromEntries(
                stats.map(item => [item.date, item.todayVisits || 0])
            );

            const weeklyData = dates.map(dateStr => ({
                date: dateStr,
                day: formatVnChartLabel(dateStr),
                visits: statsMap[dateStr] || 0,
            }));

            const thisWeek = weeklyData.reduce((sum, item) => sum + item.visits, 0);

            return { weeklyData, thisWeek };
        } catch (error) {
            console.error('Error getting weekly stats:', error);
            return { weeklyData: [], thisWeek: 0 };
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
