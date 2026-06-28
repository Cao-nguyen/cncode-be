const progressService = require('./tiendo.service');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class ProgressController {
    async upsertProgress(req, res) {
        try {
            const progress = await progressService.upsertProgress(
                req.userId,
                req.params.lessonId,
                req.body
            );
            return successResponse(res, 200, 'Progress updated', progress);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to update progress', err);
        }
    }

    async getProgress(req, res) {
        try {
            const progress = await progressService.getProgress(req.userId, req.params.lessonId);
            return successResponse(res, 200, 'Progress retrieved', progress);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get progress', err);
        }
    }

    async getCourseProgress(req, res) {
        try {
            const data = await progressService.getCourseProgress(req.userId, req.params.courseId);
            return successResponse(res, 200, 'Course progress', data);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get course progress', err);
        }
    }
}

module.exports = new ProgressController();