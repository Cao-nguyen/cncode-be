const enrollmentService = require('./enrollment.service');
const Course = require('../khoahoc/khoahoc.model');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class EnrollmentController {
    async create(req, res) {
        try {
            const enrollment = await enrollmentService.create({
                ...req.body,
                userId: req.userId
            });
            return successResponse(res, 201, 'Enrolled successfully', enrollment);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to enroll', err);
        }
    }

    async getById(req, res) {
        try {
            const enrollment = await enrollmentService.getById(req.params.id);
            if (!enrollment) return errorResponse(res, 404, 'Enrollment not found');
            return successResponse(res, 200, 'Enrollment retrieved', enrollment);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve enrollment', err);
        }
    }

    async getByUserAndCourse(req, res) {
        try {
            const enrollment = await enrollmentService.getByUserAndCourse(
                req.userId,
                req.params.courseId
            );
            if (!enrollment) return errorResponse(res, 404, 'Not enrolled');
            return successResponse(res, 200, 'Enrollment retrieved', enrollment);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve enrollment', err);
        }
    }

    async getByUserId(req, res) {
        try {
            const enrollments = await enrollmentService.getByUserId(req.userId);
            return successResponse(res, 200, 'Enrollments retrieved', enrollments);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve enrollments', err);
        }
    }

    async getUserTransactions(req, res) {
        try {
            const enrollments = await enrollmentService.getByUserId(req.userId);
            
            // Populate course details
            const transactions = await Promise.all(enrollments.map(async (enrollment) => {
                const course = await Course.findById(enrollment.courseId).select('title thumbnail price discountPrice').lean();
                return {
                    ...enrollment.toObject(),
                    course: course || null
                };
            }));

            return successResponse(res, 200, 'Transactions retrieved', transactions);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve transactions', err);
        }
    }

    async updatePaymentStatus(req, res) {
        try {
            const enrollment = await enrollmentService.updatePaymentStatus(
                req.params.id,
                req.body.status
            );
            if (!enrollment) return errorResponse(res, 404, 'Enrollment not found');
            return successResponse(res, 200, 'Payment status updated', enrollment);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to update payment status', err);
        }
    }

    async delete(req, res) {
        try {
            const enrollment = await enrollmentService.delete(req.params.id);
            if (!enrollment) return errorResponse(res, 404, 'Enrollment not found');
            return successResponse(res, 200, 'Enrollment deleted', null);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to delete enrollment', err);
        }
    }
}

module.exports = new EnrollmentController();