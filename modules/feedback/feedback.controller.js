const feedbackService = require('./feedback.service');

class FeedbackController {
    async createFeedback(req, res) {
        try {
            const userId = req.userId;
            const { title, content, category, isPublic } = req.body;

            const feedback = await feedbackService.createFeedback(userId, {
                title, content, category, isPublic
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
    }

    async getFeedbacks(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);
            const status = req.query.status || null;
            const category = req.query.category || null;

            const result = await feedbackService.getFeedbacks(page, limit, status, category);

            res.json({
                success: true,
                data: result.feedbacks,
                stats: {
                    byStatus: result.statusStats,
                    byCategory: result.categories
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
    }

    async getAllFeedbacksForAdmin(req, res) {
        try {
            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập'
                });
            }

            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 100);
            const status = req.query.status || null;
            const category = req.query.category || null;
            const search = req.query.search || '';

            const result = await feedbackService.getAllFeedbacksForAdmin(page, limit, status, category, search);

            res.json({
                success: true,
                data: result.feedbacks,
                stats: {
                    byStatus: result.statusStats,
                    byCategory: result.categories
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
    }

    async getFeedbackById(req, res) {
        try {
            const { id } = req.params;
            const feedback = await feedbackService.getFeedbackById(id);

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
    }

    async updateFeedbackStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, adminNote } = req.body;
            const adminId = req.userId;

            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền thực hiện hành động này'
                });
            }

            const feedback = await feedbackService.updateFeedbackStatus(id, status, adminId, adminNote);

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
    }

    async likeFeedback(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;

            const result = await feedbackService.likeFeedback(id, userId);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Like feedback error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async deleteFeedback(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const isAdmin = req.userRole === 'admin';

            await feedbackService.deleteFeedback(id, userId, isAdmin);

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
    }

    async getUserFeedbacks(req, res) {
        try {
            const userId = req.userId;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 10, 50);

            const result = await feedbackService.getUserFeedbacks(userId, page, limit);

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
    }

    async updateFeedback(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const { title, content, category } = req.body;

            if (!title || title.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tiêu đề không được để trống'
                });
            }
            if (!content || content.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Nội dung không được để trống'
                });
            }

            const feedback = await feedbackService.updateFeedback(id, userId, { title, content, category });

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
    }
}

module.exports = new FeedbackController();