const exerciseService = require('./baitap.service');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class ExerciseController {
    async create(req, res) {
        try {
            const exercise = await exerciseService.create(req.body);
            return successResponse(res, 201, 'Exercise created', exercise);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to create exercise', err);
        }
    }

    async createByLessonId(req, res) {
        try {
            const { lessonId } = req.params;
            const exerciseData = { ...req.body, lessonId };
            const exercise = await exerciseService.create(exerciseData);
            return successResponse(res, 201, 'Exercise created', exercise);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to create exercise', err);
        }
    }

    async getById(req, res) {
        try {
            const exercise = await exerciseService.getById(req.params.id);
            if (!exercise) return errorResponse(res, 404, 'Exercise not found');
            // Normalize questions to new format
            const normalizedExercise = {
                ...exercise.toObject(),
                questions: exercise.questions.map(q => exerciseService.normalizeQuestion(q))
            };
            return successResponse(res, 200, 'Exercise retrieved', normalizedExercise);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve exercise', err);
        }
    }

    async getByLessonId(req, res) {
        try {
            const exercise = await exerciseService.getByLessonId(req.params.lessonId);
            if (!exercise) return successResponse(res, 200, 'Exercise retrieved', null);
            // Normalize questions to new format
            const normalizedExercise = {
                ...exercise.toObject(),
                questions: exercise.questions.map(q => exerciseService.normalizeQuestion(q))
            };
            return successResponse(res, 200, 'Exercise retrieved', normalizedExercise);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve exercise', err);
        }
    }

    async update(req, res) {
        try {
            const exercise = await exerciseService.update(req.params.id, req.body);
            if (!exercise) return errorResponse(res, 404, 'Exercise not found');
            return successResponse(res, 200, 'Exercise updated', exercise);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to update exercise', err);
        }
    }

    async delete(req, res) {
        try {
            const exercise = await exerciseService.delete(req.params.id);
            if (!exercise) return errorResponse(res, 404, 'Exercise not found');
            return successResponse(res, 200, 'Exercise deleted', null);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to delete exercise', err);
        }
    }

    async submit(req, res) {
        try {
            const { answer } = req.body;
            const result = await exerciseService.checkAnswer(req.params.id, answer);
            return successResponse(res, 200, 'Answer submitted', result);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to submit answer', err);
        }
    }
}

module.exports = new ExerciseController();