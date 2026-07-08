const dautruongService = require('./dautruong.service');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class DauTruongController {
    // ===== ADMIN =====
    async create(req, res) {
        try {
            // Validation
            if (!req.body.title || !req.body.title.trim()) {
                return errorResponse(res, 400, 'Tiêu đề là bắt buộc');
            }
            if (!req.body.startTime) {
                return errorResponse(res, 400, 'Thời gian bắt đầu là bắt buộc');
            }

            const contest = await dautruongService.createContest({
                ...req.body,
                createdBy: req.userId
            });

            // Return contest wrapped in expected format
            return successResponse(res, 201, 'Contest created', { contest });
        } catch (err) {
            console.error('Error creating contest:', err);
            return errorResponse(res, 500, err.message || 'Không thể lưu cuộc thi');
        }
    }

    async update(req, res) {
        try {
            const contest = await dautruongService.updateContest(req.params.id, req.body);
            console.log('Contest updated:', contest);
            return successResponse(res, 200, 'Contest updated', { contest });
        } catch (err) {
            console.error('Error updating contest:', err);
            return errorResponse(res, 500, 'Failed to update contest', err);
        }
    }

    async delete(req, res) {
        try {
            await dautruongService.deleteContest(req.params.id);
            return successResponse(res, 200, 'Contest deleted', null);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to delete contest', err);
        }
    }

    async getAdminList(req, res) {
        try {
            const data = await dautruongService.getAdminContests(req.query);
            return successResponse(res, 200, 'Admin contests', data);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get contests', err);
        }
    }

    async getById(req, res) {
        try {
            const contest = await dautruongService.getContestById(req.params.id);
            return successResponse(res, 200, 'Contest retrieved', contest);
        } catch (err) {
            return errorResponse(res, 404, 'Contest not found', err);
        }
    }

    // ===== PUBLIC =====
    async getPublicList(req, res) {
        try {
            const data = await dautruongService.getPublicContests(req.query);
            return successResponse(res, 200, 'Public contests', data);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get contests', err);
        }
    }

    async getBySlug(req, res) {
        try {
            const contest = await dautruongService.getContestBySlug(req.params.slug);
            return successResponse(res, 200, 'Contest retrieved', contest);
        } catch (err) {
            return errorResponse(res, 404, 'Contest not found', err);
        }
    }

    async getPublicById(req, res) {
        try {
            const contest = await dautruongService.getPublicContestById(req.params.id);
            if (!contest) {
                return errorResponse(res, 404, 'Contest not found');
            }
            return successResponse(res, 200, 'Contest retrieved', contest);
        } catch (err) {
            return errorResponse(res, 404, 'Contest not found', err);
        }
    }

    async getForTaking(req, res) {
        try {
            const contest = await dautruongService.getContestForTaking(req.params.id);
            return successResponse(res, 200, 'Contest ready', contest);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Failed to get contest', err);
        }
    }

    // ===== USER SUBMISSION =====
    async submit(req, res) {
        try {
            const result = await dautruongService.submitAnswer(
                req.params.id,
                req.userId,
                req.body.answers,
                req.body.timeSpent
            );
            return successResponse(res, 200, 'Answer submitted', result);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Failed to submit', err);
        }
    }

    // ===== LEADERBOARD =====
    async getContestLeaderboard(req, res) {
        try {
            const leaderboard = await dautruongService.getContestLeaderboard(
                req.params.id,
                parseInt(req.query.limit) || 50
            );
            return successResponse(res, 200, 'Leaderboard retrieved', leaderboard);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get leaderboard', err);
        }
    }

    async getOverallLeaderboard(req, res) {
        try {
            const leaderboard = await dautruongService.getOverallLeaderboard(
                parseInt(req.query.limit) || 50
            );
            return successResponse(res, 200, 'Overall leaderboard', leaderboard);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get leaderboard', err);
        }
    }

    // ===== USER RESULTS =====
    async getUserAnswer(req, res) {
        try {
            const result = await dautruongService.getUserAnswer(req.params.id, req.userId);
            return successResponse(res, 200, 'Answer retrieved', result);
        } catch (err) {
            return errorResponse(res, 404, err.message || 'Answer not found', err);
        }
    }

    async getUserContests(req, res) {
        try {
            const contests = await dautruongService.getUserContests(req.userId);
            return successResponse(res, 200, 'User contests', contests);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get contests', err);
        }
    }

    async getUserContestHistory(req, res) {
        try {
            const history = await dautruongService.getUserContestHistory(req.params.id, req.userId);
            return successResponse(res, 200, 'User contest history', history);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get contest history', err);
        }
    }

    async checkUserAttempts(req, res) {
        try {
            const attempts = await dautruongService.checkUserAttempts(req.params.id, req.userId);
            return successResponse(res, 200, 'Attempt info', attempts);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to check attempts', err);
        }
    }
}

module.exports = new DauTruongController();
