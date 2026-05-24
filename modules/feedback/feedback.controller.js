// controllers/feedback.controller.js (sửa theo database)
const feedbackService = require('./feedback.service');

class FeedbackController {
    async createFeedback(req, res) {
        try {
            const userId = req.userId;
            const { title, content, category, priority } = req.body;

            const feedback = await feedbackService.createFeedback(userId, {
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
            const priority = req.query.priority || null;
            const search = req.query.search || '';

            const result = await feedbackService.getAllFeedbacksForAdmin(page, limit, status, category, priority, search);

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
            const { status, adminResponse } = req.body;
            const adminId = req.userId;

            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền thực hiện hành động này'
                });
            }

            const feedback = await feedbackService.updateFeedbackStatus(id, status, adminId, adminResponse);

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

    async togglePinFeedback(req, res) {
        try {
            const { id } = req.params;
            const adminId = req.userId;

            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền thực hiện hành động này'
                });
            }

            const feedback = await feedbackService.togglePinFeedback(id, adminId);

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
    }

    async toggleLockFeedback(req, res) {
        try {
            const { id } = req.params;
            const adminId = req.userId;

            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền thực hiện hành động này'
                });
            }

            const feedback = await feedbackService.toggleLockFeedback(id, adminId);

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
    }

    async reactFeedback(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;

            const result = await feedbackService.reactFeedback(id, userId);

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
            const { title, content, category, priority } = req.body;

            const feedback = await feedbackService.updateFeedback(id, userId, {
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
    }

    async getStats(req, res) {
        try {
            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập'
                });
            }

            const stats = await feedbackService.getStats();

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
    }
}

module.exports = new FeedbackController();