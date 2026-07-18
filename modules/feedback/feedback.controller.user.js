const service = require('./feedback.service.user');

const createFeedback = async (req, res) => {
    try {
        const userId = req.userId;
        const { title, content, category, priority } = req.body;

        const feedback = await service.createFeedback(userId, {
            title, content, category, priority
        });

        res.status(201).json({
            success: true,
            message: 'Gửi góp ý thành công! Cảm ơn bạn đã đóng góp ý kiến.',
            data: feedback
        });
    } catch (error) {
        console.error('Create feedback error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const getFeedbacks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const status = req.query.status || null;
        const category = req.query.category || null;

        const result = await service.getFeedbacks(page, limit, status, category);

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
        console.error('Get feedbacks error:', error);
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

const reactFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        const result = await service.reactFeedback(id, userId);

        res.json({
            success: true,
            message: 'Cảm ơn bạn đã ủng hộ!',
            data: result
        });
    } catch (error) {
        console.error('React feedback error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const deleteFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        await service.deleteFeedback(id, userId);

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

const getUserFeedbacks = async (req, res) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        const result = await service.getUserFeedbacks(userId, page, limit);

        res.json({
            success: true,
            data: result.feedbacks,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get user feedbacks error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const { title, content, category, priority } = req.body;

        const feedback = await service.updateFeedback(id, userId, {
            title, content, category, priority
        });

        res.json({
            success: true,
            message: 'Cập nhật góp ý thành công',
            data: feedback
        });
    } catch (error) {
        console.error('Update feedback error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    createFeedback,
    getFeedbacks,
    getFeedbackById,
    reactFeedback,
    deleteFeedback,
    getUserFeedbacks,
    updateFeedback,
};
