const CrossPromotion = require('./cross-promotion.model');
const crossPromotionService = require('./cross-promotion.service');
const { AppError } = require('../../utils/errors');

// Public - User gửi yêu cầu hợp tác
exports.createRequest = async (req, res, next) => {
    try {
        const { title, content, cooperationType, requesterInfo } = req.body;

        if (!title || !content || !cooperationType) {
            throw new AppError('Vui lòng điền đầy đủ thông tin', 400);
        }

        const request = await crossPromotionService.createRequest(req.userId, {
            title,
            content,
            cooperationType,
            requesterInfo,
        });

        res.status(201).json({
            success: true,
            message: 'Gửi yêu cầu thành công. CNcode sẽ xem xét và phản hồi sớm.',
            data: request,
        });
    } catch (error) {
        next(error);
    }
};

// Public - Lấy danh sách yêu cầu đã được duyệt (approved hoặc completed)
exports.getPublicRequests = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status = 'approved' } = req.query;

        const query = { status: { $in: ['approved', 'completed'] } };
        if (status && (status === 'approved' || status === 'completed')) {
            query.status = status;
        }

        const requests = await CrossPromotion.find(query)
            .populate('requester', 'name email avatar')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await CrossPromotion.countDocuments(query);

        res.json({
            success: true,
            data: requests,
            pagination: {
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

// User - Lấy yêu cầu của mình
exports.getMyRequests = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const requests = await CrossPromotion.find({ requester: req.userId })
            .populate('requester', 'fullName email avatar')
            .populate('adminResponse.respondedBy', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await CrossPromotion.countDocuments({ requester: req.userId });

        res.json({
            success: true,
            data: requests,
            pagination: {
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Admin - Lấy tất cả yêu cầu
exports.getAllRequests = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;

        const query = {};
        if (status) {
            query.status = status;
        }
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { 'requesterInfo.organizationName': { $regex: search, $options: 'i' } },
            ];
        }

        const requests = await CrossPromotion.find(query)
            .populate('requester', 'fullName email avatar')
            .populate('adminResponse.respondedBy', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await CrossPromotion.countDocuments(query);

        res.json({
            success: true,
            data: requests,
            pagination: {
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Admin - Lấy chi tiết yêu cầu
exports.getRequestById = async (req, res, next) => {
    try {
        const request = await CrossPromotion.findById(req.params.id)
            .populate('requester', 'fullName email avatar phone')
            .populate('adminResponse.respondedBy', 'fullName email');

        if (!request) {
            throw new AppError('Không tìm thấy yêu cầu', 404);
        }

        res.json({
            success: true,
            data: request,
        });
    } catch (error) {
        next(error);
    }
};

// Admin - Cập nhật trạng thái yêu cầu
exports.updateRequestStatus = async (req, res, next) => {
    try {
        const { status, message } = req.body;

        if (!status || !['approved', 'rejected', 'completed'].includes(status)) {
            throw new AppError('Trạng thái không hợp lệ', 400);
        }

        const request = await CrossPromotion.findById(req.params.id);
        if (!request) {
            throw new AppError('Không tìm thấy yêu cầu', 404);
        }

        const updatedRequest = await crossPromotionService.updateRequestStatus(
            req.params.id,
            req.userId,
            status,
            message
        );

        res.json({
            success: true,
            message: 'Cập nhật trạng thái thành công',
            data: updatedRequest,
        });
    } catch (error) {
        next(error);
    }
};

// Admin - Xóa yêu cầu
exports.deleteRequest = async (req, res, next) => {
    try {
        const request = await CrossPromotion.findByIdAndDelete(req.params.id);

        if (!request) {
            throw new AppError('Không tìm thấy yêu cầu', 404);
        }

        res.json({
            success: true,
            message: 'Xóa yêu cầu thành công',
        });
    } catch (error) {
        next(error);
    }
};

// Admin - Thống kê
exports.getStats = async (req, res, next) => {
    try {
        const [total, pending, approved, rejected, completed] = await Promise.all([
            CrossPromotion.countDocuments(),
            CrossPromotion.countDocuments({ status: 'pending' }),
            CrossPromotion.countDocuments({ status: 'approved' }),
            CrossPromotion.countDocuments({ status: 'rejected' }),
            CrossPromotion.countDocuments({ status: 'completed' }),
        ]);

        res.json({
            success: true,
            data: {
                total,
                pending,
                approved,
                rejected,
                completed,
            },
        });
    } catch (error) {
        next(error);
    }
};