const luyenTapService = require('./luyentap.service');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class LuyenTapController {
    // ===== ADMIN =====
    async create(req, res) {
        try {
            if (!req.body.title || !req.body.title.trim()) {
                return errorResponse(res, 400, 'Tiêu đề là bắt buộc');
            }
            if (!req.body.duration) {
                return errorResponse(res, 400, 'Thời gian làm bài là bắt buộc');
            }

            const exercise = await luyenTapService.createExercise({
                ...req.body,
                createdBy: req.userId
            });

            return successResponse(res, 201, 'Bài tập đã được tạo', { exercise });
        } catch (err) {
            console.error('Error creating exercise:', err);
            return errorResponse(res, 500, err.message || 'Không thể lưu bài tập');
        }
    }

    async update(req, res) {
        try {
            const exercise = await luyenTapService.updateExercise(req.params.id, req.body);
            return successResponse(res, 200, 'Bài tập đã được cập nhật', { exercise });
        } catch (err) {
            console.error('Error updating exercise:', err);
            return errorResponse(res, 500, 'Failed to update exercise', err);
        }
    }

    async delete(req, res) {
        try {
            await luyenTapService.deleteExercise(req.params.id);
            return successResponse(res, 200, 'Bài tập đã được xóa', null);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to delete exercise', err);
        }
    }

    async getAdminList(req, res) {
        try {
            const data = await luyenTapService.getAdminExercises(req.query);
            return successResponse(res, 200, 'Danh sách bài tập', data);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get exercises', err);
        }
    }

    async getById(req, res) {
        try {
            const exercise = await luyenTapService.getExerciseById(req.params.id);
            return successResponse(res, 200, 'Bài tập', exercise);
        } catch (err) {
            return errorResponse(res, 404, 'Bài tập không tìm thấy', err);
        }
    }

    async approve(req, res) {
        try {
            const exercise = await luyenTapService.updateExercise(req.params.id, { status: 'published' });
            return successResponse(res, 200, 'Bài tập đã được duyệt', { exercise });
        } catch (err) {
            return errorResponse(res, 500, 'Failed to approve exercise', err);
        }
    }

    async reject(req, res) {
        try {
            const exercise = await luyenTapService.updateExercise(req.params.id, {
                status: 'draft',
                rejectionReason: req.body.reason
            });
            return successResponse(res, 200, 'Bài tập đã bị từ chối', { exercise });
        } catch (err) {
            return errorResponse(res, 500, 'Failed to reject exercise', err);
        }
    }

    // ===== PUBLIC =====
    async getPublicList(req, res) {
        try {
            const data = await luyenTapService.getPublicExercises(req.query);
            return successResponse(res, 200, 'Danh sách bài tập', data);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get exercises', err);
        }
    }

    async getBySlug(req, res) {
        try {
            const exercise = await luyenTapService.getExerciseBySlug(req.params.slug);
            return successResponse(res, 200, 'Bài tập', exercise);
        } catch (err) {
            return errorResponse(res, 404, 'Bài tập không tìm thấy', err);
        }
    }

    async getPublicById(req, res) {
        try {
            const exercise = await luyenTapService.getPublicExerciseById(req.params.id);
            if (!exercise) {
                return errorResponse(res, 404, 'Bài tập không tìm thấy');
            }
            return successResponse(res, 200, 'Bài tập', exercise);
        } catch (err) {
            return errorResponse(res, 404, 'Bài tập không tìm thấy', err);
        }
    }

    async getForTaking(req, res) {
        try {
            const exercise = await luyenTapService.getExerciseForTaking(req.params.id);
            return successResponse(res, 200, 'Bài tập', exercise);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Failed to get exercise', err);
        }
    }

    // ===== USER SUBMISSION =====
    async submit(req, res) {
        try {
            const result = await luyenTapService.submitAnswer(
                req.params.id,
                req.userId,
                req.body.answers,
                req.body.timeSpent
            );
            return successResponse(res, 200, 'Nộp bài thành công', result);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Failed to submit', err);
        }
    }

    // ===== LEADERBOARD =====
    async getExerciseLeaderboard(req, res) {
        try {
            const leaderboard = await luyenTapService.getExerciseLeaderboard(
                req.params.id,
                parseInt(req.query.limit) || 50
            );
            return successResponse(res, 200, 'Bảng xếp hạng', leaderboard);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get leaderboard', err);
        }
    }

    async getOverallLeaderboard(req, res) {
        try {
            const leaderboard = await luyenTapService.getOverallLeaderboard(
                parseInt(req.query.limit) || 50
            );
            return successResponse(res, 200, 'Bảng xếp hạng tổng', leaderboard);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get leaderboard', err);
        }
    }

    // ===== USER RESULTS =====
    async getUserAnswer(req, res) {
        try {
            const answerId = req.query.answerId;
            const result = await luyenTapService.getUserAnswer(req.params.id, req.userId, answerId);
            return successResponse(res, 200, 'Kết quả', result);
        } catch (err) {
            return errorResponse(res, 404, err.message || 'Kết quả không tìm thấy', err);
        }
    }

    async getUserExercises(req, res) {
        try {
            const exercises = await luyenTapService.getUserExercises(req.userId);
            return successResponse(res, 200, 'Bài tập đã làm', exercises);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get exercises', err);
        }
    }

    async getUserExerciseHistory(req, res) {
        try {
            const history = await luyenTapService.getUserExerciseHistory(req.params.id, req.userId);
            return successResponse(res, 200, 'Lịch sử làm bài', history);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get exercise history', err);
        }
    }

    async checkUserAttempts(req, res) {
        try {
            const attempts = await luyenTapService.checkUserAttempts(req.params.id, req.userId);
            return successResponse(res, 200, 'Thông tin làm bài', attempts);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to check attempts', err);
        }
    }
}

module.exports = new LuyenTapController();
