const luyenTapService = require('./luyentap.service');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

exports.listPublic = async (req, res) => {
    try {
        const { page, limit, tier, search } = req.query;
        const data = await luyenTapService.listPublic({
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            tier,
            search,
            userId: req.userId,
        });
        return successResponse(res, 200, 'Success', data);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

exports.getById = async (req, res) => {
    try {
        const data = await luyenTapService.getById(req.params.id, { userId: req.userId });
        if (!data) return errorResponse(res, 404, 'Không tìm thấy bài tập');
        if (data.error === 'PRO_REQUIRED') return errorResponse(res, 403, 'Bài tập Pro — cần đăng ký khóa học Pro');
        if (data.error === 'LOGIN_REQUIRED') return errorResponse(res, 401, 'Vui lòng đăng nhập');
        if (data.error === 'NOT_FOUND') return errorResponse(res, 404, 'Không tìm thấy bài tập');
        return successResponse(res, 200, 'Success', data);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

exports.getForTaking = async (req, res) => {
    try {
        const data = await luyenTapService.getForTaking(req.params.id, req.userId);
        if (data?.error === 'LOGIN_REQUIRED') return errorResponse(res, 401, 'Vui lòng đăng nhập');
        if (data?.error === 'PRO_REQUIRED') return errorResponse(res, 403, 'Bài tập Pro — cần đăng ký khóa học Pro');
        if (!data || data.error) return errorResponse(res, 404, 'Không tìm thấy bài tập');
        return successResponse(res, 200, 'Success', data);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

exports.submitAttempt = async (req, res) => {
    try {
        const { answers } = req.body;
        if (!Array.isArray(answers)) return errorResponse(res, 400, 'answers phải là mảng');
        const data = await luyenTapService.submitAttempt(req.params.id, req.userId, answers);
        return successResponse(res, 200, data.passed ? 'Hoàn thành xuất sắc!' : 'Đã nộp bài', data);
    } catch (err) {
        return errorResponse(res, 400, err.message);
    }
};

exports.getAttempt = async (req, res) => {
    try {
        const data = await luyenTapService.getAttempt(req.params.attemptId, req.userId);
        if (!data) return errorResponse(res, 404, 'Không tìm thấy kết quả');
        return successResponse(res, 200, 'Success', data);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

exports.getMyAttempts = async (req, res) => {
    try {
        const data = await luyenTapService.getMyAttempts(req.params.id, req.userId);
        return successResponse(res, 200, 'Success', data);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

exports.runCodeTest = async (req, res) => {
    try {
        const { language, code, input, expectedOutput } = req.body;
        const data = await luyenTapService.runCodeTest({ language, code, input, expectedOutput });
        return successResponse(res, 200, 'Success', data);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

// Admin
exports.listAdmin = async (req, res) => {
    try {
        const data = await luyenTapService.listAdmin({
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            status: req.query.status,
            search: req.query.search,
        });
        return successResponse(res, 200, 'Success', data);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

exports.createAdmin = async (req, res) => {
    try {
        const data = await luyenTapService.create({ ...req.body, status: req.body.status || 'approved', publishedAt: new Date() }, req.userId);
        return successResponse(res, 201, 'Tạo bài tập thành công', data);
    } catch (err) {
        return errorResponse(res, 400, err.message);
    }
};

exports.updateAdmin = async (req, res) => {
    try {
        const data = await luyenTapService.update(req.params.id, req.body, req.userId, true);
        return successResponse(res, 200, 'Cập nhật thành công', data);
    } catch (err) {
        return errorResponse(res, 400, err.message);
    }
};

exports.deleteAdmin = async (req, res) => {
    try {
        await luyenTapService.delete(req.params.id, req.userId, true);
        return successResponse(res, 200, 'Xóa thành công');
    } catch (err) {
        return errorResponse(res, 400, err.message);
    }
};

exports.approve = async (req, res) => {
    try {
        const data = await luyenTapService.approve(req.params.id, req.userId);
        return successResponse(res, 200, 'Duyệt bài tập thành công', data);
    } catch (err) {
        return errorResponse(res, 400, err.message);
    }
};

exports.reject = async (req, res) => {
    try {
        const { reason } = req.body;
        const data = await luyenTapService.reject(req.params.id, req.userId, reason);
        return successResponse(res, 200, 'Từ chối bài tập', data);
    } catch (err) {
        return errorResponse(res, 400, err.message);
    }
};

// Teacher
exports.listTeacher = async (req, res) => {
    try {
        const data = await luyenTapService.listTeacher(req.userId, {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            status: req.query.status,
        });
        return successResponse(res, 200, 'Success', data);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

exports.createTeacher = async (req, res) => {
    try {
        const data = await luyenTapService.create({ ...req.body, status: 'draft' }, req.userId);
        return successResponse(res, 201, 'Tạo bài tập thành công', data);
    } catch (err) {
        return errorResponse(res, 400, err.message);
    }
};

exports.updateTeacher = async (req, res) => {
    try {
        const data = await luyenTapService.update(req.params.id, req.body, req.userId, false);
        return successResponse(res, 200, 'Cập nhật thành công', data);
    } catch (err) {
        return errorResponse(res, 400, err.message);
    }
};

exports.deleteTeacher = async (req, res) => {
    try {
        await luyenTapService.delete(req.params.id, req.userId, false);
        return successResponse(res, 200, 'Xóa thành công');
    } catch (err) {
        return errorResponse(res, 400, err.message);
    }
};

exports.submitForReview = async (req, res) => {
    try {
        const data = await luyenTapService.submitForReview(req.params.id, req.userId);
        return successResponse(res, 200, 'Gửi duyệt thành công', data);
    } catch (err) {
        return errorResponse(res, 400, err.message);
    }
};

exports.getAdminById = async (req, res) => {
    try {
        const practice = await require('./luyentap.model').PracticeSet.findById(req.params.id)
            .populate('author', 'fullName email username');
        if (!practice) return errorResponse(res, 404, 'Không tìm thấy');
        return successResponse(res, 200, 'Success', practice);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};

exports.getTeacherById = async (req, res) => {
    try {
        const practice = await require('./luyentap.model').PracticeSet.findById(req.params.id);
        if (!practice) return errorResponse(res, 404, 'Không tìm thấy');
        if (practice.author.toString() !== req.userId) return errorResponse(res, 403, 'Không có quyền');
        return successResponse(res, 200, 'Success', practice);
    } catch (err) {
        return errorResponse(res, 500, err.message);
    }
};
