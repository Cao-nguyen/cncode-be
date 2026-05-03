const Feedback = require('./feedback.model');
const Notification = require('../notification/notification.model');
const User = require('../user/user.model');

function getIo() {
    try {
        const { getIo } = require('../../server');
        const io = getIo?.();
        return io;
    } catch (e) {
        console.error('❌ Feedback getIo error:', e.message);
        return null;
    }
}

class FeedbackService {
    async createFeedback(userId, data) {
        const { title, content, category, isPublic = true } = data;

        if (!title || title.trim().length === 0) {
            throw new Error('Tiêu đề không được để trống');
        }
        if (title.length > 200) {
            throw new Error('Tiêu đề không được quá 200 ký tự');
        }
        if (!content || content.trim().length === 0) {
            throw new Error('Nội dung không được để trống');
        }
        if (content.length > 2000) {
            throw new Error('Nội dung không được quá 2000 ký tự');
        }

        const user = await User.findById(userId).select('fullName username avatar');

        const feedback = new Feedback({
            userId,
            title: title.trim(),
            content: content.trim(),
            category: category || 'other',
            isPublic
        });

        await feedback.save();
        await feedback.populate('userId', '_id fullName email avatar username');

        const admins = await User.find({ role: 'admin' }).select('_id');
        const adminIds = admins.map(admin => admin._id);

        const io = getIo();

        if (adminIds.length > 0) {
            const notificationContent = `📝 ${user?.fullName || 'Người dùng'} vừa gửi góp ý mới: "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}"`;

            const notifications = await Notification.insertMany(
                adminIds.map(adminId => ({
                    userId: adminId,
                    senderId: userId,
                    type: 'system',
                    content: notificationContent,
                    meta: { feedbackId: feedback._id, title, category },
                    read: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }))
            );

            if (io) {
                notifications.forEach((notification, index) => {
                    io.to(adminIds[index].toString()).emit('new_notification', {
                        _id: notification._id,
                        userId: adminIds[index],
                        senderId: userId,
                        type: 'system',
                        content: notificationContent,
                        meta: { feedbackId: feedback._id, title, category },
                        read: false,
                        createdAt: notification.createdAt,
                        updatedAt: notification.updatedAt
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

        let query = { isPublic: true };
        if (status && status !== 'all') {
            query.status = status;
        }
        if (category && category !== 'all') {
            query.category = category;
        }

        const [feedbacks, total, statusStats, categoryStats] = await Promise.all([
            Feedback.find(query)
                .populate('userId', '_id fullName email avatar username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Feedback.countDocuments(query),
            Feedback.getStatusStats(),
            Feedback.aggregate([
                { $match: { isPublic: true } },
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ])
        ]);

        const categories = {};
        categoryStats.forEach(stat => {
            categories[stat._id] = stat.count;
        });

        return {
            feedbacks,
            statusStats,
            categories,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getAllFeedbacksForAdmin(page = 1, limit = 20, status = null, category = null, search = '') {
        const skip = (page - 1) * limit;

        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        if (category && category !== 'all') {
            query.category = category;
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
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Feedback.countDocuments(query),
            Feedback.getStatusStats(),
            Feedback.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ])
        ]);

        const categories = {};
        categoryStats.forEach(stat => {
            categories[stat._id] = stat.count;
        });

        return {
            feedbacks,
            statusStats,
            categories,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getFeedbackById(feedbackId) {
        const feedback = await Feedback.findById(feedbackId).populate('userId', '_id fullName email avatar username');
        if (!feedback) {
            throw new Error('Không tìm thấy góp ý');
        }
        return feedback;
    }

    async updateFeedbackStatus(feedbackId, status, adminId, adminNote = '') {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            throw new Error('Không tìm thấy góp ý');
        }

        const validStatuses = ['pending', 'viewed', 'approved', 'in_progress', 'completed', 'rejected'];
        if (!validStatuses.includes(status)) {
            throw new Error('Trạng thái không hợp lệ');
        }

        const oldStatus = feedback.status;
        feedback.status = status;
        feedback.adminNote = adminNote;

        if (status === 'viewed' && !feedback.viewedAt) feedback.viewedAt = new Date();
        if (status === 'approved' && !feedback.approvedAt) feedback.approvedAt = new Date();
        if (status === 'in_progress' && !feedback.inProgressAt) feedback.inProgressAt = new Date();
        if (status === 'completed' && !feedback.completedAt) feedback.completedAt = new Date();
        if (status === 'rejected' && !feedback.rejectedAt) feedback.rejectedAt = new Date();

        await feedback.save();
        await feedback.populate('userId', '_id fullName email avatar username');

        const statusMessages = {
            viewed: 'Admin đã xem góp ý của bạn',
            approved: 'Góp ý của bạn đã được duyệt',
            in_progress: 'Góp ý của bạn đang được xử lý',
            completed: 'Góp ý của bạn đã hoàn thành! Cảm ơn bạn đã đóng góp',
            rejected: 'Rất tiếc, góp ý của bạn không được duyệt'
        };

        if (statusMessages[status]) {
            const admin = await User.findById(adminId).select('fullName');

            const notification = await Notification.create({
                userId: feedback.userId,
                senderId: adminId,
                type: 'system',
                content: `${statusMessages[status]}${adminNote ? `: ${adminNote}` : ''}`,
                meta: { feedbackId, oldStatus, newStatus: status },
                read: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const io = getIo();
            if (io) {
                io.to(feedback.userId.toString()).emit('new_notification', {
                    _id: notification._id,
                    userId: feedback.userId,
                    senderId: adminId,
                    type: 'system',
                    content: `${statusMessages[status]}${adminNote ? `: ${adminNote}` : ''}`,
                    meta: { feedbackId, oldStatus, newStatus: status },
                    read: false,
                    createdAt: notification.createdAt,
                    updatedAt: notification.updatedAt
                });
            }
        }

        const io = getIo();
        if (io) {
            io.emit('feedback_updated', feedback);
            io.emit('feedback_status_changed', { feedbackId, oldStatus, newStatus: status });
        }

        return feedback;
    }

    async likeFeedback(feedbackId, userId) {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            throw new Error('Không tìm thấy góp ý');
        }

        const alreadyLiked = feedback.likedBy.includes(userId);

        if (alreadyLiked) {
            feedback.likes -= 1;
            feedback.likedBy = feedback.likedBy.filter(id => id.toString() !== userId);
        } else {
            feedback.likes += 1;
            feedback.likedBy.push(userId);
        }

        await feedback.save();
        await feedback.populate('userId', '_id fullName email avatar username');

        const io = getIo();
        if (io) {
            // Broadcast cho tất cả mọi người
            io.emit('feedback_liked', {
                feedbackId,
                likes: feedback.likes,
                likedBy: feedback.likedBy,
                userId: userId,
                liked: !alreadyLiked
            });
        }

        return { likes: feedback.likes, liked: !alreadyLiked, likedBy: feedback.likedBy };
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
        const { title, content, category } = data;

        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            throw new Error('Không tìm thấy góp ý');
        }

        if (feedback.userId.toString() !== userId) {
            throw new Error('Bạn không có quyền chỉnh sửa góp ý này');
        }

        // Không cho chỉnh sửa nếu đã hoàn thành hoặc từ chối
        if (feedback.status === 'completed' || feedback.status === 'rejected') {
            throw new Error('Góp ý đã hoàn thành hoặc bị từ chối, không thể chỉnh sửa');
        }

        feedback.title = title.trim();
        feedback.content = content.trim();
        feedback.category = category || feedback.category;

        await feedback.save();
        await feedback.populate('userId', '_id fullName email avatar username');

        const io = getIo();
        if (io) {
            io.emit('feedback_updated', feedback);
        }

        return feedback;
    }
}

module.exports = new FeedbackService();