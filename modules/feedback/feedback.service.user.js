const Feedback = require('./feedback.model');
const Notification = require('../notification/notification.model');
const User = require('../user/user.model');
const socketService = require('../../services/socket.service');
const {
    CATEGORIES,
    PRIORITIES,
    CATEGORY_LABELS,
    LIST_SORT,
    attachFeedbackMeta,
} = require('./feedback.constants');

function getIo() {
    try {
        return socketService.getIO();
    } catch (e) {
        console.error('❌ Feedback getIo error:', e.message);
        return null;
    }
}

async function createFeedback(userId, data) {
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

    const validCategories = CATEGORIES;
    const finalCategory = validCategories.includes(category) ? category : 'other';

    const validPriorities = PRIORITIES;
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
        const categoryLabels = CATEGORY_LABELS;
        const notificationContent = `${user?.fullName || 'Người dùng'} vừa gửi góp ý [${categoryLabels[finalCategory]}]: "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}"`;

        const notifications = await Notification.insertMany(
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
            console.log(`📢 Sending feedback notification to ${adminIds.length} admin(s)`);
            notifications.forEach((notification, index) => {
                const adminId = adminIds[index].toString();
                io.to(adminId).emit('new_notification', {
                    _id: notification._id,
                    userId: notification.userId,
                    senderId: userId,
                    type: 'system',
                    content: notificationContent,
                    meta: { feedbackId: feedback._id, title, category: finalCategory, priority: finalPriority },
                    read: false,
                    createdAt: notification.createdAt
                });
            });
        }
    }

    if (io) {
        io.emit('feedback_created', feedback);
    }

    return feedback;
}

async function getFeedbacks(page = 1, limit = 20, status = null, category = null, userId = null, search = '') {
    const skip = (page - 1) * limit;

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (category && category !== 'all') query.category = category;
    if (search?.trim()) {
        query.$or = [
            { title: { $regex: search.trim(), $options: 'i' } },
            { content: { $regex: search.trim(), $options: 'i' } },
        ];
    }

    const [feedbacks, total, statusStats, categoryStats] = await Promise.all([
        Feedback.find(query)
            .populate('userId', '_id fullName email avatar username')
            .sort(LIST_SORT)
            .skip(skip)
            .limit(limit)
            .lean(),
        Feedback.countDocuments(query),
        Feedback.getStatusStats(),
        Feedback.getCategoryStats()
    ]);

    return {
        feedbacks: attachFeedbackMeta(feedbacks, userId),
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

async function getFeedbackById(feedbackId, userId = null) {
    const feedback = await Feedback.findById(feedbackId)
        .populate('userId', '_id fullName email avatar username')
        .populate('reviewedBy', '_id fullName')
        .lean();

    if (!feedback) {
        throw new Error('Không tìm thấy góp ý');
    }

    await Feedback.findByIdAndUpdate(feedbackId, { $inc: { viewCount: 1 } });
    feedback.viewCount += 1;

    return attachFeedbackMeta([feedback], userId)[0];
}

async function reactFeedback(feedbackId, userId) {
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
        throw new Error('Không tìm thấy góp ý');
    }

    if (feedback.isLocked) {
        throw new Error('Góp ý đã bị khóa, không thể ủng hộ');
    }

    const alreadyLiked = feedback.likedBy.some((id) => id.toString() === userId.toString());
    let action = '';

    if (alreadyLiked) {
        feedback.reactCount = Math.max(0, feedback.reactCount - 1);
        feedback.likedBy = feedback.likedBy.filter(id => id.toString() !== userId.toString());
        action = 'unliked';
    } else {
        feedback.reactCount += 1;
        feedback.likedBy.push(userId);
        action = 'liked';

        if (feedback.userId.toString() !== userId.toString()) {
            const liker = await User.findById(userId).select('fullName avatar');
            const notificationContent = `${liker?.fullName || 'Ai đó'} đã ủng hộ góp ý của bạn: "${feedback.title.substring(0, 50)}${feedback.title.length > 50 ? '...' : ''}"`;

            const notification = await Notification.create({
                userId: feedback.userId,
                senderId: userId,
                type: 'system',
                content: notificationContent,
                meta: { feedbackId: feedback._id, action: 'liked' },
                read: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const io = getIo();
            if (io) {
                io.to(feedback.userId.toString()).emit('new_notification', {
                    _id: notification._id,
                    userId: feedback.userId,
                    senderId: userId,
                    type: 'system',
                    content: notificationContent,
                    meta: { feedbackId: feedback._id, action: 'liked' },
                    read: false,
                    createdAt: notification.createdAt
                });
            }
        }
    }

    await feedback.save();
    await feedback.populate('userId', '_id fullName email avatar username');

    const io = getIo();
    if (io) {
        io.emit('feedback_reacted', {
            feedbackId: feedback._id,
            reactCount: feedback.reactCount,
            userId: userId,
            likedBy: feedback.likedBy,
            action: action
        });
    }

    return {
        reactCount: feedback.reactCount,
        liked: action === 'liked',
        likedBy: feedback.likedBy,
        action: action
    };
}

async function deleteFeedback(feedbackId, userId) {
    const feedback = await Feedback.findById(feedbackId);

    if (!feedback) {
        throw new Error('Không tìm thấy góp ý');
    }

    if (feedback.userId.toString() !== userId) {
        throw new Error('Bạn không có quyền xóa góp ý này');
    }

    await Feedback.findByIdAndDelete(feedbackId);

    const io = getIo();
    if (io) {
        io.emit('feedback_deleted', feedbackId);
    }

    return { success: true };
}

async function getUserFeedbacks(userId, page = 1, limit = 10, status = null, category = null, search = '') {
    const skip = (page - 1) * limit;

    const query = { userId };
    if (status && status !== 'all') query.status = status;
    if (category && category !== 'all') query.category = category;
    if (search?.trim()) {
        query.$or = [
            { title: { $regex: search.trim(), $options: 'i' } },
            { content: { $regex: search.trim(), $options: 'i' } },
        ];
    }

    const [feedbacks, total] = await Promise.all([
        Feedback.find(query)
            .populate('userId', '_id fullName email avatar username')
            .sort(LIST_SORT)
            .skip(skip)
            .limit(limit)
            .lean(),
        Feedback.countDocuments(query)
    ]);

    return {
        feedbacks: attachFeedbackMeta(feedbacks, userId),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

async function updateFeedback(feedbackId, userId, data) {
    const { title, content, category, priority } = data;

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
        throw new Error('Không tìm thấy góp ý');
    }

    if (feedback.userId.toString() !== userId) {
        throw new Error('Bạn không có quyền chỉnh sửa góp ý này');
    }

    if (feedback.isLocked) {
        throw new Error('Góp ý đã bị khóa, không thể chỉnh sửa');
    }

    if (feedback.status === 'completed' || feedback.status === 'rejected') {
        throw new Error('Góp ý đã hoàn thành hoặc bị từ chối, không thể chỉnh sửa');
    }

    if (title) feedback.title = title.trim();
    if (content) feedback.content = content.trim();
    if (category && CATEGORIES.includes(category)) {
        feedback.category = category;
    }
    if (priority && PRIORITIES.includes(priority)) {
        feedback.priority = priority;
    }

    await feedback.save();
    await feedback.populate('userId', '_id fullName email avatar username');

    const io = getIo();
    if (io) {
        io.emit('feedback_updated', feedback);
    }

    return attachFeedbackMeta([feedback.toObject()], userId)[0];
}

module.exports = {
    createFeedback,
    getFeedbacks,
    getFeedbackById,
    reactFeedback,
    deleteFeedback,
    getUserFeedbacks,
    updateFeedback,
};
