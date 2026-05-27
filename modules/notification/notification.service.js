const Notification = require('./notification.model');

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

    const populated = await Notification.findById(notification._id)
        .populate('senderId', 'fullName avatar _id');

    return populated;
};

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

const getUnreadCount = async (userId) => {
    return Notification.countDocuments({ userId, read: false });
};

const markAsRead = async (notificationId, userId) => {
    return Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true },
        { new: true }
    );
};

const markAllAsRead = async (userId) => {
    return Notification.updateMany({ userId, read: false }, { read: true });
};

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
