const service = require('./gift.service.admin');

const getAllGifts = async (req, res) => {
    try {
        const gifts = await service.getAllGifts();
        res.json({ success: true, data: gifts });
    } catch (error) {
        console.error('Get all gifts admin error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy danh sách quà tặng' });
    }
};

const createGift = async (req, res) => {
    try {
        const gift = await service.createGift(req.body);
        res.status(201).json({ success: true, data: gift, message: 'Tạo quà tặng thành công' });
    } catch (error) {
        console.error('Create gift admin error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi tạo quà tặng' });
    }
};

const updateGift = async (req, res) => {
    try {
        const gift = await service.updateGift(req.params.id, req.body);
        res.json({ success: true, data: gift, message: 'Cập nhật quà tặng thành công' });
    } catch (error) {
        console.error('Update gift admin error:', error);
        const status = error.message === 'Không tìm thấy quà tặng' ? 404 : 400;
        res.status(status).json({ success: false, message: error.message || 'Lỗi khi cập nhật quà tặng' });
    }
};

const deleteGift = async (req, res) => {
    try {
        await service.deleteGift(req.params.id);
        res.json({ success: true, message: 'Đã xóa quà tặng thành công' });
    } catch (error) {
        console.error('Delete gift admin error:', error);
        const status = error.message === 'Không tìm thấy quà tặng' ? 404 : 500;
        res.status(status).json({ success: false, message: error.message || 'Lỗi khi xóa quà tặng' });
    }
};

const getStats = async (req, res) => {
    try {
        const stats = await service.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get gift stats error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy thống kê' });
    }
};

const getRevenueChart = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 10;
        const data = await service.getRevenueChart(days);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Get gift revenue chart error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy biểu đồ doanh thu' });
    }
};

const getTopGifts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const data = await service.getTopGifts(limit);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Get top gifts error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy top quà tặng' });
    }
};

const getCategoryChart = async (req, res) => {
    try {
        const data = await service.getCategoryChart();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Get gift category chart error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy biểu đồ danh mục' });
    }
};

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
