const courseService = require('./khoahoc.service');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class CourseController {
    // ===== PUBLIC =====
    async getPublicList(req, res) {
        try {
            const data = await courseService.getPublicList(req.query);
            return successResponse(res, 200, 'Courses retrieved', data);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get courses', err);
        }
    }

    async getBySlug(req, res) {
        try {
            const data = await courseService.getBySlug(req.params.slug);
            return successResponse(res, 200, 'Course retrieved', data);
        } catch (err) {
            return errorResponse(res, 404, err.message || 'Course not found', err);
        }
    }

    // ===== TEACHER =====
    async getTeacherCourses(req, res) {
        try {
            const courses = await courseService.getTeacherCourses(req.userId);
            return successResponse(res, 200, 'Teacher courses', courses);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get courses', err);
        }
    }

    async create(req, res) {
        try {
            const course = await courseService.create({ ...req.body, teacherId: req.userId });
            return successResponse(res, 201, 'Course created', course);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to create course', err);
        }
    }

    async update(req, res) {
        try {
            const course = await courseService.update(req.params.id, req.userId, req.body);
            return successResponse(res, 200, 'Course updated', course);
        } catch (err) {
            return errorResponse(res, 500, err.message || 'Failed to update', err);
        }
    }

    async submitForReview(req, res) {
        try {
            const course = await courseService.submitForReview(req.params.id, req.userId);
            return successResponse(res, 200, 'Submitted for review', course);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Failed to submit', err);
        }
    }

    async toggleHide(req, res) {
        try {
            const course = await courseService.toggleHide(req.params.id, req.userId);
            return successResponse(res, 200, 'Visibility toggled', course);
        } catch (err) {
            return errorResponse(res, 500, err.message || 'Failed to toggle', err);
        }
    }

    async delete(req, res) {
        try {
            await courseService.delete(req.params.id, req.userId);
            return successResponse(res, 200, 'Course deleted', null);
        } catch (err) {
            return errorResponse(res, 400, err.message || 'Failed to delete', err);
        }
    }

    // ===== LEARN =====
    async getLearnData(req, res) {
        try {
            const data = await courseService.getLearnData(req.params.courseId, req.userId);
            return successResponse(res, 200, 'Learn data', data);
        } catch (err) {
            return errorResponse(res, 403, err.message || 'Access denied', err);
        }
    }

    // ===== ADMIN =====
    async getAdminList(req, res) {
        try {
            const data = await courseService.getAdminList(req.query);
            return successResponse(res, 200, 'Admin courses', data);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get courses', err);
        }
    }

    async approve(req, res) {
        try {
            const course = await courseService.approve(req.params.id);
            return successResponse(res, 200, 'Course approved', course);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to approve', err);
        }
    }

    async reject(req, res) {
        try {
            const course = await courseService.reject(req.params.id, req.body.reason);
            return successResponse(res, 200, 'Course rejected', course);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to reject', err);
        }
    }

    async adminUpdate(req, res) {
        try {
            const course = await courseService.adminUpdate(req.params.id, req.body);
            return successResponse(res, 200, 'Course updated', course);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to update', err);
        }
    }

    async adminDelete(req, res) {
        try {
            await courseService.adminDelete(req.params.id);
            return successResponse(res, 200, 'Course deleted', null);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to delete', err);
        }
    }

    async getStats(req, res) {
        try {
            const stats = await courseService.getStats();
            return successResponse(res, 200, 'Stats retrieved', stats);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get stats', err);
        }
    }

    // ===== USER =====
    async getUserCourses(req, res) {
        try {
            const data = await courseService.getUserCourses(req.userId);
            return successResponse(res, 200, 'My courses', data);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get courses', err);
        }
    }
}

module.exports = new CourseController();