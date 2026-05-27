
const Feedback = require('./feedback.model');
const Notification = require('../notification/notification.model');
const User = require('../user/user.model');

function getIo() {
    try {
        const { getIo } = require('../../server');
        const io = getIo?.();
        return io;
    } catch (e) {
        console.error('Feedback getIo error:', e.message);
        return null;
    }
}

class FeedbackService {
    async createFeedback(userId, data) {
        const { title, content, category, priority = 'medium' } = data;

        if (!title || title.trim().length === 0) {
            throw new Error('Tiêu đề không được để trống');
        }
        if (title.length > 200) {
            throw new Error('Tiêu đề không được quá 200 ký tự');
        }
        if (!content || content.trim().length === 0) {
            throw new Error('Nội dung không được để trống');
        }

        const validCategories = ['bug', 'ui_ux', 'feature_request', 'performance', 'security', 'other'];
        const finalCategory = validCategories.includes(category) ? category : 'other';

        const validPriorities = ['low', 'medium', 'high'];
        const finalPriority = validPriorities.includes(priority) ? priority : 'medium';

        const user = await User.findById(userId).select('fullName username avatar');

        const feedback = new Feedback({
            userId,
            title: title.trim(),
            content: content.trim(),
            category: finalCategory,
            priority: finalPriority,
            status: 'pending'
        });

        await feedback.save();
        await feedback.populate('userId', '_id fullName email avatar username');

        const admins = await User.find({ role: 'admin' }).select('_id');
        const adminIds = admins.map(admin => admin._id);
        const io = getIo();

        if (adminIds.length > 0) {
            const categoryLabels = {
                bug: 'Lỗi', ui_ux: 'UI/UX', feature_request: 'Tính năng mới',
                performance: 'Hiệu năng', security: 'Bảo mật', other: 'Khác'
            };
            const notificationContent = `${user?.fullName || 'Người dùng'} vừa gửi góp ý [${categoryLabels[finalCategory]}]: "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}"`;

            await Notification.insertMany(
                adminIds.map(adminId => ({
                    userId: adminId,
                    senderId: userId,
                    type: 'system',
                    content: notificationContent,
                    meta: { feedbackId: feedback._id, title, category: finalCategory, priority: finalPriority },
                    read: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }))
            );

            if (io) {
                adminIds.forEach(adminId => {
                    io.to(adminId.toString()).emit('new_notification', {
                        type: 'feedback_created',
                        feedbackId: feedback._id,
                        title,
                        category: finalCategory
                    });
                });
            }
        }

        if (io) {
            io.emit('feedback_created', feedback);
        }

        return feedback;
    }

    async getFeedbacks(page = 1, limit = 20, status = null, category = null) {
        const skip = (page - 1) * limit;

        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        if (category && category !== 'all') {
            query.category = category;
        }

        const [feedbacks, total, statusStats, categoryStats] = await Promise.all([
            Feedback.find(query)
                .populate('userId', '_id fullName email avatar username')
                .sort({ createdAt: -1, isPinned: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Feedback.countDocuments(query),
            Feedback.getStatusStats(),
            Feedback.getCategoryStats()
        ]);

        return {
            feedbacks,
            statusStats,
            categoryStats,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getAllFeedbacksForAdmin(page = 1, limit = 20, status = null, category = null, priority = null, search = '') {
        const skip = (page - 1) * limit;

        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        if (category && category !== 'all') {
            query.category = category;
        }
        if (priority && priority !== 'all') {
            query.priority = priority;
        }
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }

        const [feedbacks, total, statusStats, categoryStats] = await Promise.all([
            Feedback.find(query)
                .populate('userId', '_id fullName email avatar username')
                .populate('reviewedBy', '_id fullName')
                .sort({ createdAt: -1, isPinned: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Feedback.countDocuments(query),
            Feedback.getStatusStats(),
            Feedback.getCategoryStats()
        ]);

        return {
            feedbacks,
            statusStats,
            categoryStats,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getFeedbackById(feedbackId) {
        const feedback = await Feedback.findById(feedbackId)
            .populate('userId', '_id fullName email avatar username')
            .populate('reviewedBy', '_id fullName');

        if (!feedback) {
            throw new Error('Không tìm thấy góp ý');
        }

        feedback.viewCount += 1;
        await feedback.save();

        return feedback;
    }

    async updateFeedbackStatus(feedbackId, status, adminId, adminResponse = '') {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            throw new Error('Không tìm thấy góp ý');
        }

        const validStatuses = ['pending', 'viewed', 'approved', 'improving', 'completed', 'rejected'];
        if (!validStatuses.includes(status)) {
            throw new Error('Trạng thái không hợp lệ');
        }

        const oldStatus = feedback.status;
        feedback.status = status;
        feedback.adminResponse = adminResponse;
        feedback.reviewedBy = adminId;

        if (status === 'viewed' && !feedback.reviewedAt) {
            feedback.reviewedAt = new Date();
        }
        if (status === 'approved' && !feedback.reviewedAt) {
            feedback.reviewedAt = new Date();
        }
        if (status === 'improving' && !feedback.reviewedAt) {
            feedback.reviewedAt = new Date();
        }
        if (status === 'completed' && !feedback.reviewedAt) {
            feedback.reviewedAt = new Date();
        }
        if (status === 'rejected' && !feedback.reviewedAt) {
            feedback.reviewedAt = new Date();
        }

        await feedback.save();
        await feedback.populate('userId', '_id fullName email avatar username');

        const statusMessages = {
            viewed: 'Admin đã xem góp ý của bạn',
            approved: 'Góp ý của bạn đã được duyệt và sẽ được xem xét',
            improving: 'Góp ý của bạn đang được chúng tôi cải tiến',
            completed: 'Góp ý của bạn đã được hoàn thành! Cảm ơn bạn đã đóng góp',
            rejected: 'Rất tiếc, góp ý của bạn không được duyệt'
        };

        if (statusMessages[status]) {
            const admin = await User.findById(adminId).select('fullName');

            await Notification.create({
                userId: feedback.userId,
                senderId: adminId,
                type: 'system',
                content: `${statusMessages[status]}${adminResponse ? `: ${adminResponse}` : ''}`,
                meta: { feedbackId, oldStatus, newStatus: status },
                read: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const io = getIo();
            if (io) {
                io.to(feedback.userId.toString()).emit('feedback_status_changed', {
                    feedbackId,
                    oldStatus,
                    newStatus: status,
                    adminResponse
                });
            }
        }

        const io = getIo();
        if (io) {
            io.emit('feedback_updated', feedback);
        }

        return feedback;
    }

    async togglePinFeedback(feedbackId, adminId) {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            throw new Error('Không tìm thấy góp ý');
        }

        feedback.isPinned = !feedback.isPinned;
        feedback.reviewedBy = adminId;
        feedback.reviewedAt = new Date();
        await feedback.save();

        const io = getIo();
        if (io) {
            io.emit('feedback_updated', feedback);
        }

        return feedback;
    }

    async toggleLockFeedback(feedbackId, adminId) {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            throw new Error('Không tìm thấy góp ý');
        }

        feedback.isLocked = !feedback.isLocked;
        feedback.reviewedBy = adminId;
        feedback.reviewedAt = new Date();
        await feedback.save();

        const io = getIo();
        if (io) {
            io.emit('feedback_updated', feedback);
        }

        return feedback;
    }

    async reactFeedback(feedbackId, userId) {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            throw new Error('Không tìm thấy góp ý');
        }

        const alreadyLiked = feedback.likedBy.includes(userId);

        if (alreadyLiked) {
            
            throw new Error('Bạn đã ủng hộ góp ý này rồi');
        } else {
            
            feedback.reactCount += 1;
            feedback.likedBy.push(userId);
            await feedback.save();
        }

        await feedback.populate('userId', '_id fullName email avatar username');

        const io = getIo();
        if (io) {
            io.emit('feedback_reacted', {
                feedbackId: feedback._id,
                reactCount: feedback.reactCount,
                userId: userId,
                likedBy: feedback.likedBy
            });
        }

        return {
            reactCount: feedback.reactCount,
            liked: true,
            likedBy: feedback.likedBy
        };
    }

    async deleteFeedback(feedbackId, userId, isAdmin = false) {
        const feedback = await Feedback.findById(feedbackId);

        if (!feedback) {
            throw new Error('Không tìm thấy góp ý');
        }

        if (!isAdmin && feedback.userId.toString() !== userId) {
            throw new Error('Bạn không có quyền xóa góp ý này');
        }

        await Feedback.findByIdAndDelete(feedbackId);

        const io = getIo();
        if (io) {
            io.emit('feedback_deleted', feedbackId);
        }

        return { success: true };
    }

    async getUserFeedbacks(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [feedbacks, total] = await Promise.all([
            Feedback.find({ userId })
                .populate('userId', '_id fullName email avatar username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Feedback.countDocuments({ userId })
        ]);

        return {
            feedbacks,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async updateFeedback(feedbackId, userId, data) {
        const { title, content, category, priority } = data;

        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            throw new Error('Không tìm thấy góp ý');
        }

        if (feedback.userId.toString() !== userId) {
            throw new Error('Bạn không có quyền chỉnh sửa góp ý này');
        }

        if (feedback.status === 'completed' || feedback.status === 'rejected') {
            throw new Error('Góp ý đã hoàn thành hoặc bị từ chối, không thể chỉnh sửa');
        }

        if (title) feedback.title = title.trim();
        if (content) feedback.content = content.trim();
        if (category && ['bug', 'ui_ux', 'feature_request', 'performance', 'security', 'other'].includes(category)) {
            feedback.category = category;
        }
        if (priority && ['low', 'medium', 'high'].includes(priority)) {
            feedback.priority = priority;
        }

        await feedback.save();
        await feedback.populate('userId', '_id fullName email avatar username');

        const io = getIo();
        if (io) {
            io.emit('feedback_updated', feedback);
        }

        return feedback;
    }

    async getStats() {
        const [statusStats, categoryStats, priorityStats, total] = await Promise.all([
            Feedback.getStatusStats(),
            Feedback.getCategoryStats(),
            Feedback.aggregate([
                { $group: { _id: '$priority', count: { $sum: 1 } } }
            ]),
            Feedback.countDocuments()
        ]);

        const priorityResult = { low: 0, medium: 0, high: 0 };
        priorityStats.forEach(stat => {
            if (priorityResult.hasOwnProperty(stat._id)) {
                priorityResult[stat._id] = stat.count;
            }
        });

        return {
            statusStats,
            categoryStats,
            priorityStats: priorityResult,
            total
        };
    }
}

module.exports = new FeedbackService();
