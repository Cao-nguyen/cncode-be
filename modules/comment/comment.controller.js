
const commentService = require('./comment.service');

class CommentController {
    
    async createComment(req, res) {
        try {
            const userId = req.userId;
            const { targetType, targetId, parentId, content, attachments } = req.body;

            const comment = await commentService.createComment(userId, {
                targetType,
                targetId,
                parentId,
                content,
                attachments
            });

            res.status(201).json({
                success: true,
                message: 'Bình luận thành công',
                data: comment
            });
        } catch (error) {
            console.error('Create comment error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getCommentsByTarget(req, res) {
        try {
            const { targetType, targetId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);
            const sortBy = req.query.sortBy || 'latest';

            const result = await commentService.getCommentsByTarget(targetType, targetId, page, limit, sortBy);

            if (req.userId && result.comments.length > 0) {
                const commentIds = result.comments.map(c => c._id);
                const userReactions = await commentService.getUserReactionsForComments(req.userId, commentIds);

                result.comments = result.comments.map(comment => ({
                    ...comment,
                    userReaction: userReactions.get(comment._id.toString()) || null
                }));
            }

            res.json({
                success: true,
                data: result.comments,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get comments error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getRepliesByParent(req, res) {
        try {
            const { parentId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);

            const result = await commentService.getRepliesByParent(parentId, page, limit);

            res.json({
                success: true,
                data: result.replies,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get replies error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async updateComment(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const { content } = req.body;

            const comment = await commentService.updateComment(id, userId, content);

            res.json({
                success: true,
                message: 'Cập nhật bình luận thành công',
                data: comment
            });
        } catch (error) {
            console.error('Update comment error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async deleteComment(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const isAdmin = req.userRole === 'admin';

            await commentService.deleteComment(id, userId, isAdmin);

            res.json({
                success: true,
                message: 'Xóa bình luận thành công'
            });
        } catch (error) {
            console.error('Delete comment error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async hardDeleteComment(req, res) {
        try {
            const { id } = req.params;
            const adminId = req.userId;

            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền thực hiện hành động này'
                });
            }

            await commentService.hardDeleteComment(id, adminId);

            res.json({
                success: true,
                message: 'Xóa bình luận thành công'
            });
        } catch (error) {
            console.error('Hard delete comment error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async reactToComment(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const { type } = req.body;

            const result = await commentService.reactToComment(id, userId, type);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('React to comment error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async reportComment(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const { reason, description } = req.body;

            const report = await commentService.reportComment(id, userId, reason, description);

            res.status(201).json({
                success: true,
                message: 'Báo cáo bình luận thành công',
                data: report
            });
        } catch (error) {
            console.error('Report comment error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getReports(req, res) {
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

            const result = await commentService.getReportsForAdmin(page, limit, status);

            res.json({
                success: true,
                data: result.reports,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get reports error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async resolveReport(req, res) {
        try {
            const { id } = req.params;
            const adminId = req.userId;
            const { actionTaken, status } = req.body;

            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền thực hiện hành động này'
                });
            }

            const report = await commentService.resolveReport(id, adminId, actionTaken, status);

            res.json({
                success: true,
                message: 'Xử lý báo cáo thành công',
                data: report
            });
        } catch (error) {
            console.error('Resolve report error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getReactionUsers(req, res) {
        try {
            const { id } = req.params;
            const { type } = req.query;  
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);

            const reactionType = (type && type !== 'all') ? type : null;

            const result = await commentService.getReactionUsers(id, reactionType, page, limit);

            res.json({
                success: true,
                data: result.users,
                total: result.total,
                page: result.page,
                totalPages: result.totalPages
            });
        } catch (error) {
            console.error('Get reaction users error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new CommentController();
