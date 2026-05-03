// modules/rating/rating.controller.js
const ratingService = require('./rating.service');

class RatingController {
    // Tạo đánh giá mới
    async createRating(req, res) {
        try {
            const userId = req.userId;

            console.log('Create rating - userId:', userId);

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Không tìm thấy thông tin người dùng'
                });
            }

            const { rating, content } = req.body;

            // Validate
            if (!rating || rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'Đánh giá phải từ 1 đến 5 sao'
                });
            }

            if (!content || content.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Nội dung đánh giá không được để trống'
                });
            }

            const newRating = await ratingService.createRating(userId, rating, content);

            res.status(201).json({
                success: true,
                message: 'Gửi đánh giá thành công',
                data: newRating
            });
        } catch (error) {
            console.error('Create rating error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Lấy danh sách đánh giá công khai
    async getRatings(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 10, 50);

            const result = await ratingService.getRatings(page, limit);

            res.json({
                success: true,
                data: result.ratings,
                stats: result.stats,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get ratings error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Lấy tất cả đánh giá cho admin
    async getAllRatingsForAdmin(req, res) {
        try {
            // Kiểm tra quyền admin
            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập'
                });
            }

            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 100);
            const search = req.query.search || '';

            const result = await ratingService.getAllRatingsForAdmin(page, limit, search);

            res.json({
                success: true,
                data: result.ratings,
                stats: result.stats,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get all ratings error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Lấy đánh giá theo ID
    async getRatingById(req, res) {
        try {
            const { id } = req.params;
            const rating = await ratingService.getRatingById(id);

            if (!rating) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy đánh giá'
                });
            }

            res.json({
                success: true,
                data: rating
            });
        } catch (error) {
            console.error('Get rating by id error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Cập nhật đánh giá (user tự cập nhật)
    async updateRating(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const { rating, content } = req.body;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Không tìm thấy thông tin người dùng'
                });
            }

            const updatedRating = await ratingService.updateRating(id, userId, { rating, content });

            res.json({
                success: true,
                message: 'Cập nhật đánh giá thành công',
                data: updatedRating
            });
        } catch (error) {
            console.error('Update rating error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Xóa đánh giá (hard delete)
    async deleteRating(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const isAdmin = req.userRole === 'admin';

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Không tìm thấy thông tin người dùng'
                });
            }

            const result = await ratingService.deleteRating(id, userId, isAdmin);

            res.json({
                success: true,
                message: 'Xóa đánh giá thành công'
            });
        } catch (error) {
            console.error('Delete rating error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Lấy đánh giá của user hiện tại
    async getMyRatings(req, res) {
        try {
            const userId = req.userId;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 10, 50);

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Không tìm thấy thông tin người dùng'
                });
            }

            const result = await ratingService.getUserRatings(userId, page, limit);

            res.json({
                success: true,
                data: result.ratings,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get my ratings error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Lấy thống kê đánh giá
    async getStats(req, res) {
        try {
            const stats = await ratingService.getStats();

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

    // Admin: Xóa nhiều đánh giá cùng lúc
    async deleteMultipleRatings(req, res) {
        try {
            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền thực hiện hành động này'
                });
            }

            const { ratingIds } = req.body;

            if (!ratingIds || !Array.isArray(ratingIds) || ratingIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng chọn đánh giá cần xóa'
                });
            }

            const result = await ratingService.deleteMultipleRatings(ratingIds);

            res.json({
                success: true,
                message: `Đã xóa ${result.deletedCount} đánh giá`
            });
        } catch (error) {
            console.error('Delete multiple ratings error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async updateRating(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const { rating, content } = req.body;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Không tìm thấy thông tin người dùng'
                });
            }

            // Validate
            if (!rating || rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'Đánh giá phải từ 1 đến 5 sao'
                });
            }

            if (!content || content.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Nội dung đánh giá không được để trống'
                });
            }

            const updatedRating = await ratingService.updateRating(id, userId, { rating, content });

            res.json({
                success: true,
                message: 'Cập nhật đánh giá thành công',
                data: updatedRating
            });
        } catch (error) {
            console.error('Update rating error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new RatingController();