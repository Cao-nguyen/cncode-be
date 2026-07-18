const Feedback = require('./feedback.model');
const Notification = require('../notification/notification.model');
const User = require('../user/user.model');
const socketService = require('../../services/socket.service');

function getIo() {
    try {
        return socketService.getIO();
    } catch (e) {
        console.error('❌ Feedback getIo error:', e.message);
        return null;
    }
}

async function getAllFeedbacks(page = 1, limit = 20, status = null, category = null, priority = null, search = '') {
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

async function getFeedbackById(feedbackId) {
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

async function updateFeedbackStatus(feedbackId, status, adminId, adminResponse = '') {
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
        const notificationContent = `${statusMessages[status]}${adminResponse ? `: ${adminResponse}` : ''}`;

        const notification = await Notification.create({
            userId: feedback.userId,
            senderId: adminId,
            type: 'system',
            content: notificationContent,
            meta: { feedbackId, oldStatus, newStatus: status },
            read: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const io = getIo();
        if (io) {
            const userIdStr = typeof feedback.userId === 'object' ? feedback.userId._id.toString() : feedback.userId.toString();

            io.to(userIdStr).emit('new_notification', {
                _id: notification._id,
                userId: feedback.userId,
                senderId: adminId,
                type: 'system',
                content: notificationContent,
                meta: { feedbackId, oldStatus, newStatus: status },
                read: false,
                createdAt: notification.createdAt
            });

            io.to(userIdStr).emit('feedback_status_changed', {
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

async function togglePinFeedback(feedbackId, adminId) {
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

async function toggleLockFeedback(feedbackId, adminId) {
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

async function deleteFeedback(feedbackId) {
    const feedback = await Feedback.findById(feedbackId);

    if (!feedback) {
        throw new Error('Không tìm thấy góp ý');
    }

    await Feedback.findByIdAndDelete(feedbackId);

    const io = getIo();
    if (io) {
        io.emit('feedback_deleted', feedbackId);
    }

    return { success: true };
}

async function getStats() {
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

module.exports = {
    getAllFeedbacks,
    getFeedbackById,
    updateFeedbackStatus,
    togglePinFeedback,
    toggleLockFeedback,
    deleteFeedback,
    getStats,
};
