const service = require('./feedback.service.admin');
const versionService = require('./feedbackVersion.service');

const getAllFeedbacks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const status = req.query.status || null;
        const category = req.query.category || null;
        const priority = req.query.priority || null;
        const search = req.query.search || '';

        const result = await service.getAllFeedbacks(page, limit, status, category, priority, search);

        res.json({
            success: true,
            data: result.feedbacks,
            stats: {
                byStatus: result.statusStats,
                byCategory: result.categoryStats
            },
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get all feedbacks error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getFeedbackById = async (req, res) => {
    try {
        const { id } = req.params;
        const feedback = await service.getFeedbackById(id);

        res.json({
            success: true,
            data: feedback
        });
    } catch (error) {
        console.error('Get feedback by id error:', error);
        res.status(404).json({
            success: false,
            message: error.message
        });
    }
};

const updateFeedbackStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminResponse } = req.body;
        const adminId = req.userId;

        const feedback = await service.updateFeedbackStatus(id, status, adminId, adminResponse);

        res.json({
            success: true,
            message: 'Cập nhật trạng thái thành công',
            data: feedback
        });
    } catch (error) {
        console.error('Update feedback status error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const togglePinFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.userId;

        const feedback = await service.togglePinFeedback(id, adminId);

        res.json({
            success: true,
            message: feedback.isPinned ? 'Đã ghim góp ý' : 'Đã bỏ ghim góp ý',
            data: feedback
        });
    } catch (error) {
        console.error('Toggle pin feedback error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const toggleLockFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.userId;

        const feedback = await service.toggleLockFeedback(id, adminId);

        res.json({
            success: true,
            message: feedback.isLocked ? 'Đã khóa góp ý' : 'Đã mở khóa góp ý',
            data: feedback
        });
    } catch (error) {
        console.error('Toggle lock feedback error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const deleteFeedback = async (req, res) => {
    try {
        const { id } = req.params;

        await service.deleteFeedback(id);

        res.json({
            success: true,
            message: 'Xóa góp ý thành công'
        });
    } catch (error) {
        console.error('Delete feedback error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const getStats = async (req, res) => {
    try {
        const stats = await service.getStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getVersions = async (req, res) => {
    try {
        const data = await versionService.listVersions({ publishedOnly: false });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Get versions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const createVersion = async (req, res) => {
    try {
        const data = await versionService.createVersion(req.userId, req.body);
        res.status(201).json({ success: true, message: 'Đã tạo phiên bản', data });
    } catch (error) {
        console.error('Create version error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateVersion = async (req, res) => {
    try {
        const data = await versionService.updateVersion(req.params.id, req.body);
        res.json({ success: true, message: 'Đã cập nhật phiên bản', data });
    } catch (error) {
        console.error('Update version error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

const deleteVersion = async (req, res) => {
    try {
        await versionService.deleteVersion(req.params.id);
        res.json({ success: true, message: 'Đã xóa phiên bản' });
    } catch (error) {
        console.error('Delete version error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllFeedbacks,
    getFeedbackById,
    updateFeedbackStatus,
    togglePinFeedback,
    toggleLockFeedback,
    deleteFeedback,
    getStats,
    getVersions,
    createVersion,
    updateVersion,
    deleteVersion,
};
