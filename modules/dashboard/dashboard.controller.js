// modules/dashboard/dashboard.controller.js
const dashboardService = require('./dashboard.service');

const getUserDashboard = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const data = await dashboardService.getUserDashboard(userId);

        res.status(200).json({
            success: true,
            data,
            message: 'Lấy dữ liệu dashboard thành công'
        });
    } catch (error) {
        console.error('Get user dashboard error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};

const getAdminDashboard = async (req, res) => {
    try {
        const data = await dashboardService.getAdminDashboard();

        res.status(200).json({
            success: true,
            data,
            message: 'Lấy dữ liệu dashboard thành công'
        });
    } catch (error) {
        console.error('Get admin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};

module.exports = {
    getUserDashboard,
    getAdminDashboard
};