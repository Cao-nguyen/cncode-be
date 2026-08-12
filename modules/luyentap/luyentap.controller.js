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
                status: req.body.status === 'draft' ? 'draft' : 'published',
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
            const payload = { ...req.body };
            if (payload.status === 'pending') {
                payload.status = 'published';
            }
            const exercise = await luyenTapService.updateExercise(req.params.id, payload);
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

    async listFolders(req, res) {
        try {
            const data = await luyenTapService.listFolders();
            return successResponse(res, 200, 'Danh sách thư mục', data);
        } catch (err) {
            return errorResponse(res, 500, err.message || 'Không thể tải thư mục', err);
        }
    }

    async createFolder(req, res) {
        try {
            const folder = await luyenTapService.createFolder({
                ...req.body,
                createdBy: req.userId,
            });
            return successResponse(res, 201, 'Đã tạo thư mục', { folder });
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Không thể tạo thư mục', err);
        }
    }

    async updateFolder(req, res) {
        try {
            const folder = await luyenTapService.updateFolder(req.params.folderId, req.body);
            return successResponse(res, 200, 'Đã cập nhật thư mục', { folder });
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Không thể cập nhật thư mục', err);
        }
    }

    async deleteFolder(req, res) {
        try {
            await luyenTapService.deleteFolder(req.params.folderId);
            return successResponse(res, 200, 'Đã xóa thư mục', null);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Không thể xóa thư mục', err);
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

    async getAdminOverview(req, res) {
        try {
            const data = await luyenTapService.getAdminExerciseOverview(req.params.id);
            return successResponse(res, 200, 'Tổng quan bài tập', data);
        } catch (err) {
            return errorResponse(res, 404, err.message || 'Không thể tải tổng quan', err);
        }
    }

    async getAdminDetailedStatistics(req, res) {
        try {
            const data = await luyenTapService.getAdminExerciseDetailedStatistics(req.params.id);
            return successResponse(res, 200, 'Thống kê chi tiết', data);
        } catch (err) {
            return errorResponse(res, 500, err.message || 'Không thể tải thống kê chi tiết', err);
        }
    }

    async getAdminSubmissions(req, res) {
        try {
            const data = await luyenTapService.getAdminSubmissions(req.params.id, req.query);
            return successResponse(res, 200, 'Danh sách bài nộp', data);
        } catch (err) {
            return errorResponse(res, 500, err.message || 'Không thể tải danh sách bài nộp', err);
        }
    }

    async getAdminSubmissionDetail(req, res) {
        try {
            const data = await luyenTapService.getAdminSubmissionDetail(
                req.params.id,
                req.params.answerId,
            );
            return successResponse(res, 200, 'Chi tiết bài nộp', data);
        } catch (err) {
            return errorResponse(res, 404, err.message || 'Không thể tải chi tiết bài nộp', err);
        }
    }

    async gradeEssayAnswers(req, res) {
        try {
            const result = await luyenTapService.gradeEssayAnswers(
                req.params.id,
                req.params.answerId,
                req.userId,
                req.body.grades,
                req.body.overallFeedback,
            );
            return successResponse(res, 200, 'Đã chấm tự luận', result);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Không thể chấm tự luận', err);
        }
    }

    async approve(req, res) {
        try {
            const exercise = await luyenTapService.updateExercise(req.params.id, { status: 'published', rejectionReason: '' });
            return successResponse(res, 200, 'Bài tập đã được duyệt', { exercise });
        } catch (err) {
            return errorResponse(res, 500, 'Failed to approve exercise', err);
        }
    }

    async reject(req, res) {
        try {
            const exercise = await luyenTapService.updateExercise(req.params.id, {
                status: 'rejected',
                rejectionReason: req.body.reason || ''
            });
            return successResponse(res, 200, 'Bài tập đã bị từ chối', { exercise });
        } catch (err) {
            return errorResponse(res, 500, 'Failed to reject exercise', err);
        }
    }

    async runCode(req, res) {
        try {
            const result = await luyenTapService.runCodeTest(req.body);
            return successResponse(res, 200, 'Chạy code', result);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Không thể chạy code', err);
        }
    }

    async scanExplanations(req, res) {
        try {
            const { content } = req.body;
            const explanations = await luyenTapService.scanExplanations(content);
            return successResponse(res, 200, 'Quét AI thành công', { explanations });
        } catch (err) {
            console.error('Scan explanations error:', err);
            return errorResponse(res, 500, err.message || 'Không thể quét AI', err);
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
            if (!exercise) {
                return errorResponse(res, 404, 'Bài tập không tìm thấy');
            }
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
            const exercise = await luyenTapService.getExerciseForTaking(req.params.id, req.userId);
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
                req.body.timeSpent,
                req.body.attemptId || null,
            );
            return successResponse(res, 200, 'Nộp bài thành công', result);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Failed to submit', err);
        }
    }

    async startAttempt(req, res) {
        try {
            const attempt = await luyenTapService.startOrResumeAttempt(req.params.id, req.userId, {
                examPassword: req.body.examPassword,
                acknowledgePreExam: Boolean(req.body.acknowledgePreExam),
            });
            return successResponse(res, 200, 'Phiên làm bài', attempt);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Failed to start attempt', err);
        }
    }

    async saveAttempt(req, res) {
        try {
            const attempt = await luyenTapService.saveAttemptProgress(
                req.params.id,
                req.userId,
                req.params.attemptId,
                req.body,
            );
            return successResponse(res, 200, 'Đã lưu tiến trình', attempt);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Failed to save attempt', err);
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

    async spinExerciseCoin(req, res) {
        try {
            const answerId = req.body.answerId || req.query.answerId;
            if (!answerId) {
                return errorResponse(res, 400, 'Thiếu answerId');
            }
            const result = await luyenTapService.spinExerciseCoin(
                req.params.id,
                req.userId,
                answerId,
            );
            return successResponse(res, 200, result.message, result);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Không thể quay xu', err);
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

    async getExerciseAccess(req, res) {
        try {
            const access = await luyenTapService.getExerciseAccessForUser(req.params.id, req.userId);
            return successResponse(res, 200, 'Trạng thái đề', access);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Không thể tải trạng thái', err);
        }
    }

    async verifyExercisePassword(req, res) {
        try {
            const result = await luyenTapService.verifyExercisePassword(req.params.id, req.body.password);
            return successResponse(res, 200, 'Xác thực thành công', result);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Mật khẩu không đúng', err);
        }
    }

    async checkUserAttempts(req, res) {
        try {
            const attempts = await luyenTapService.checkUserAttempts(req.params.id, req.userId);
            return successResponse(res, 200, 'Thông tin làm bài', attempts);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Failed to check attempts', err);
        }
    }

    async getUserPurchases(req, res) {
        try {
            const exerciseIds = await luyenTapService.getUserPurchasedExerciseIds(req.userId);
            return successResponse(res, 200, 'Đề đã mua', { exerciseIds });
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get purchases', err);
        }
    }

    async getPurchaseStatus(req, res) {
        try {
            const data = await luyenTapService.getPurchaseStatus(req.params.id, req.userId);
            return successResponse(res, 200, 'Trạng thái mua', data);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Failed to get purchase status', err);
        }
    }

    async purchaseWithCoin(req, res) {
        try {
            const result = await luyenTapService.purchaseWithCoin(req.params.id, req.userId);
            return successResponse(res, 200, result.alreadyOwned ? 'Đã sở hữu đề' : 'Mua đề thành công', result);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Không thể mua đề', err);
        }
    }

    async purchaseWithPayos(req, res) {
        try {
            const result = await luyenTapService.createPayOSPurchase(req.params.id, req.userId);
            return successResponse(res, 200, result.alreadyOwned ? 'Đã sở hữu đề' : 'Tạo thanh toán thành công', result);
        } catch (err) {
            console.error('PayOS luyentap purchase error:', err);
            return errorResponse(res, 500, err.message || 'Không thể tạo thanh toán', err);
        }
    }

    async getExerciseReactions(req, res) {
        try {
            const data = await luyenTapService.getExerciseReactions(req.params.id, req.userId || null);
            return successResponse(res, 200, 'Cảm xúc bài tập', data);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Không thể tải cảm xúc', err);
        }
    }

    async getExerciseStatistics(req, res) {
        try {
            const data = await luyenTapService.getExerciseStatistics(req.params.id, req.userId || null);
            return successResponse(res, 200, 'Thống kê bài tập', data);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Không thể tải thống kê', err);
        }
    }

    async getRecentParticipants(req, res) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 10;
            const data = await luyenTapService.getRecentParticipants(req.params.id, page, limit);
            return successResponse(res, 200, 'Danh sách tham gia', data);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Không thể tải danh sách', err);
        }
    }

    async reactToExercise(req, res) {
        try {
            const { type } = req.body;
            if (!type) {
                return errorResponse(res, 400, 'Loại cảm xúc là bắt buộc');
            }
            const data = await luyenTapService.reactToExercise(req.params.id, req.userId, type);
            return successResponse(res, 200, data.reacted ? 'Đã thả cảm xúc' : 'Đã bỏ cảm xúc', data);
        } catch (err) {
            console.error('reactToExercise error:', err);
            return errorResponse(res, 400, err.message || 'Không thể thả cảm xúc', err);
        }
    }
}

module.exports = new LuyenTapController();
