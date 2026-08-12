const { Gift } = require('./gift.model');
const { GiftTransaction } = require('./gift-transaction.model');

const VN_TZ = 'Asia/Ho_Chi_Minh';

function formatVNDate(date) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: VN_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function addDaysToDateStr(dateStr, days) {
    const base = new Date(`${dateStr}T12:00:00+07:00`);
    base.setUTCDate(base.getUTCDate() + days);
    return formatVNDate(base);
}

function vnDayStart(dateStr) {
    return new Date(`${dateStr}T00:00:00+07:00`);
}

function vnDayEnd(dateStr) {
    return new Date(`${dateStr}T23:59:59.999+07:00`);
}

async function getAllGifts() {    return Gift.find().sort({ order: 1, createdAt: -1 });
}

async function createGift(data) {
    const { name, description, image, priceInXu, category, isActive, order } = data;

    return Gift.create({
        name,
        description,
        image,
        priceInXu,
        category,
        isActive: isActive !== undefined ? isActive : true,
        order: order || 0,
    });
}

async function updateGift(id, data) {
    const { name, description, image, priceInXu, category, isActive, order } = data;

    const gift = await Gift.findByIdAndUpdate(
        id,
        { name, description, image, priceInXu, category, isActive, order },
        { new: true, runValidators: true }
    );

    if (!gift) {
        throw new Error('Không tìm thấy quà tặng');
    }

    return gift;
}

async function deleteGift(id) {
    const gift = await Gift.findByIdAndDelete(id);

    if (!gift) {
        throw new Error('Không tìm thấy quà tặng');
    }

    return gift;
}

async function getStats() {
    const [totalGifts, activeGifts, transactionStats] = await Promise.all([
        Gift.countDocuments(),
        Gift.countDocuments({ isActive: true }),
        GiftTransaction.aggregate([
            {
                $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalRevenue: { $sum: '$coinsSpent' },
                    totalConverted: { $sum: { $cond: [{ $eq: ['$isConverted', true] }, 1, 0] } },
                },
            },
        ]),
    ]);

    const stats = transactionStats[0] || {
        totalTransactions: 0,
        totalRevenue: 0,
        totalConverted: 0,
    };

    return {
        totalGifts,
        activeGifts,
        inactiveGifts: totalGifts - activeGifts,
        totalTransactions: stats.totalTransactions,
        totalRevenue: stats.totalRevenue,
        totalConverted: stats.totalConverted,
    };
}

async function getRevenueChart(daysCount = 10) {
    const todayStr = formatVNDate(new Date());
    const startStr = addDaysToDateStr(todayStr, -(daysCount - 1));
    const startDate = vnDayStart(startStr);
    const endDate = vnDayEnd(todayStr);

    const revenueByDate = await GiftTransaction.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$createdAt',
                        timezone: VN_TZ,
                    },
                },
                revenue: { $sum: '$coinsSpent' },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const dataMap = {};
    revenueByDate.forEach((item) => {
        dataMap[item._id] = { revenue: item.revenue, count: item.count };
    });

    const chartData = [];
    let current = startStr;

    for (let i = 0; i < daysCount; i++) {
        chartData.push({
            date: current,
            revenue: dataMap[current]?.revenue || 0,
            count: dataMap[current]?.count || 0,
        });
        current = addDaysToDateStr(current, 1);
    }

    return chartData;
}
async function getTopGifts(limit = 5) {
    const results = await GiftTransaction.aggregate([
        {
            $group: {
                _id: '$gift',
                count: { $sum: 1 },
                revenue: { $sum: '$coinsSpent' },
            },
        },
        { $sort: { count: -1, revenue: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: 'gifts',
                localField: '_id',
                foreignField: '_id',
                as: 'gift',
            },
        },
        { $unwind: '$gift' },
        {
            $project: {
                _id: '$gift._id',
                name: '$gift.name',
                image: '$gift.image',
                priceInXu: '$gift.priceInXu',
                category: '$gift.category',
                isActive: '$gift.isActive',
                count: 1,
                revenue: 1,
            },
        },
    ]);

    return results;
}

async function getCategoryChart() {
    const results = await GiftTransaction.aggregate([
        {
            $lookup: {
                from: 'gifts',
                localField: 'gift',
                foreignField: '_id',
                as: 'giftInfo',
            },
        },
        { $unwind: '$giftInfo' },
        {
            $group: {
                _id: '$giftInfo.category',
                count: { $sum: 1 },
                revenue: { $sum: '$coinsSpent' },
            },
        },
        { $sort: { count: -1 } },
    ]);

    return results.map((item) => ({
        category: item._id || 'other',
        count: item.count,
        revenue: item.revenue,
    }));
}

module.exports = {
    getAllGifts,
    createGift,
    updateGift,
    deleteGift,
    getStats,
    getRevenueChart,
    getTopGifts,
    getCategoryChart,
};
