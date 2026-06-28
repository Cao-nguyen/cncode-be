const lessonService = require('./baihoc.service');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class LessonController {
    async create(req, res) {
        try {
            const lesson = await lessonService.create(req.body);
            return successResponse(res, 201, 'Lesson created', lesson);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to create lesson', err);
        }
    }

    async getById(req, res) {
        try {
            const lesson = await lessonService.getById(req.params.id);
            if (!lesson) return errorResponse(res, 404, 'Lesson not found');
            return successResponse(res, 200, 'Lesson retrieved', lesson);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve lesson', err);
        }
    }

    async getByChapterId(req, res) {
        try {
            const lessons = await lessonService.getByChapterId(req.params.chapterId);
            return successResponse(res, 200, 'Lessons retrieved', lessons);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve lessons', err);
        }
    }

    async update(req, res) {
        try {
            const lesson = await lessonService.update(req.params.id, req.body);
            if (!lesson) return errorResponse(res, 404, 'Lesson not found');
            return successResponse(res, 200, 'Lesson updated', lesson);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to update lesson', err);
        }
    }

    async delete(req, res) {
        try {
            const lesson = await lessonService.delete(req.params.id);
            if (!lesson) return errorResponse(res, 404, 'Lesson not found');
            return successResponse(res, 200, 'Lesson deleted', null);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to delete lesson', err);
        }
    }

    async reorder(req, res) {
        try {
            await lessonService.reorder(req.params.chapterId, req.body.lessons);
            return successResponse(res, 200, 'Lessons reordered', null);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to reorder lessons', err);
        }
    }
}

module.exports = new LessonController();