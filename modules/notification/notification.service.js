const Notification = require('./notification.model');

/**
 * Tạo notification và trả về object đã populate senderId
 */
const createNotification = async ({
    userId,
    senderId = null,
    type,
    postId = null,
    postSlug = null,
    postTitle = null,
    commentId = null,
    reactionType = null,
    content = '',
    meta = {}
}) => {
    const notification = await Notification.create({
        userId,
        senderId,
        type,
        postId,
        postSlug,
        postTitle,
        commentId,
        reactionType,
        content,
        meta
    });

    // Populate senderId để trả về FE
    const populated = await Notification.findById(notification._id)
        .populate('senderId', 'fullName avatar _id');

    return populated;
};

/**
 * Lấy danh sách notifications của user (có phân trang)
 */
const getNotifications = async (userId, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find({ userId })
            .populate('senderId', 'fullName avatar _id')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Notification.countDocuments({ userId }),
        Notification.countDocuments({ userId, read: false })
    ]);

    return {
        notifications,
        total,
        unreadCount,
        page,
        totalPages: Math.ceil(total / limit)
    };
};

/**
 * Đếm số thông báo chưa đọc
 */
const getUnreadCount = async (userId) => {
    return Notification.countDocuments({ userId, read: false });
};

/**
 * Đánh dấu 1 notification là đã đọc
 */
const markAsRead = async (notificationId, userId) => {
    return Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true },
        { new: true }
    );
};

/**
 * Đánh dấu tất cả là đã đọc
 */
const markAllAsRead = async (userId) => {
    return Notification.updateMany({ userId, read: false }, { read: true });
};

/**
 * Xóa 1 notification
 */
const deleteNotification = async (notificationId, userId) => {
    return Notification.findOneAndDelete({ _id: notificationId, userId });
};

module.exports = {
    createNotification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
};