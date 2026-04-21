// modules/activity/activity.controller.js
const activityService = require('./activity.service');

const getAllActivities = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            type,
            userId,
            startDate,
            endDate,
            search,
            status
        } = req.query;

        const result = await activityService.getAllActivities(
            { type, userId, startDate, endDate, search, status },
            parseInt(page),
            parseInt(limit)
        );

        res.status(200).json({
            success: true,
            data: result.activities,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: result.total,
                totalPages: result.totalPages
            },
            message: 'Lấy danh sách hoạt động thành công'
        });
    } catch (error) {
        console.error('Get activities error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};

const getActivityStats = async (req, res) => {
    try {
        const stats = await activityService.getActivityStats();

        res.status(200).json({
            success: true,
            data: stats,
            message: 'Lấy thống kê hoạt động thành công'
        });
    } catch (error) {
        console.error('Get activity stats error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};

module.exports = {
    getAllActivities,
    getActivityStats
};