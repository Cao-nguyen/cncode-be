const certificateService = require('./chungchi.service');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class CertificateController {
    async checkEligible(req, res) {
        try {
            const result = await certificateService.checkEligible(req.userId, req.params.courseId);
            return successResponse(res, 200, 'Eligibility checked', result);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to check eligibility', err);
        }
    }

    async create(req, res) {
        try {
            const { fullName } = req.body;
            if (!fullName) return errorResponse(res, 400, 'Full name is required');
            const certificate = await certificateService.create(req.userId, req.params.courseId, fullName);
            return successResponse(res, 201, 'Certificate created', certificate);
        } catch (err) {
            return errorResponse(res, 500, err.message || 'Failed to create certificate', err);
        }
    }

    async get(req, res) {
        try {
            const certificate = await certificateService.getByUserAndCourse(req.userId, req.params.courseId);
            if (!certificate) return errorResponse(res, 404, 'Certificate not found');
            return successResponse(res, 200, 'Certificate retrieved', certificate);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get certificate', err);
        }
    }
}

module.exports = new CertificateController();