const chapterService = require('./chuong.service');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class ChapterController {
    async create(req, res) {
        try {
            const chapter = await chapterService.create(req.body);
            return successResponse(res, 201, 'Chapter created', chapter);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to create chapter', err);
        }
    }

    async getById(req, res) {
        try {
            const chapter = await chapterService.getById(req.params.id);
            if (!chapter) return errorResponse(res, 404, 'Chapter not found');
            return successResponse(res, 200, 'Chapter retrieved', chapter);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve chapter', err);
        }
    }

    async getByCourseId(req, res) {
        try {
            const chapters = await chapterService.getByCourseId(req.params.courseId);
            return successResponse(res, 200, 'Chapters retrieved', chapters);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve chapters', err);
        }
    }

    async update(req, res) {
        try {
            const chapter = await chapterService.update(req.params.id, req.body);
            if (!chapter) return errorResponse(res, 404, 'Chapter not found');
            return successResponse(res, 200, 'Chapter updated', chapter);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to update chapter', err);
        }
    }

    async delete(req, res) {
        try {
            const chapter = await chapterService.delete(req.params.id);
            if (!chapter) return errorResponse(res, 404, 'Chapter not found');
            return successResponse(res, 200, 'Chapter deleted', null);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to delete chapter', err);
        }
    }

    async reorder(req, res) {
        try {
            await chapterService.reorder(req.params.courseId, req.body.chapters);
            return successResponse(res, 200, 'Chapters reordered', null);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to reorder chapters', err);
        }
    }
}

module.exports = new ChapterController();