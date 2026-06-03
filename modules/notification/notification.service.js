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

const getNotifications = async (userId, userRole = 'user', page = 1, limit = 20) => {
    const skip = (page - 1) * limit;

    // Lấy personal notifications
    const [personalNotifications, personalTotal, personalUnreadCount] = await Promise.all([
        Notification.find({ userId })
            .populate('senderId', 'fullName avatar _id')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Notification.countDocuments({ userId }),
        Notification.countDocuments({ userId, read: false })
    ]);

    // Lấy broadcast notifications
    const { getBroadcastsForUser, getUnreadBroadcastCount } = require('../broadcast-notification/broadcast-notification.service');
    const broadcasts = await getBroadcastsForUser(userId, userRole);
    const broadcastUnreadCount = await getUnreadBroadcastCount(userId, userRole);

    // Transform broadcasts to notification format
    const broadcastNotifications = broadcasts.map(b => ({
        _id: b._id,
        type: 'policy_update',
        content: b.content,
        title: b.title,
        meta: b.meta,
        read: b.read,
        createdAt: b.createdAt,
        isBroadcast: true // Flag để frontend biết đây là broadcast
    }));

    // Merge và sort by createdAt
    const allNotifications = [...personalNotifications, ...broadcastNotifications]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(skip, skip + limit);

    const totalCount = personalTotal + broadcasts.length;
    const totalUnreadCount = personalUnreadCount + broadcastUnreadCount;

    return {
        notifications: allNotifications,
        total: totalCount,
        unreadCount: totalUnreadCount,
        page,
        totalPages: Math.ceil(totalCount / limit)
    };
};

const getUnreadCount = async (userId, userRole = 'user') => {
    const personalUnread = await Notification.countDocuments({ userId, read: false });

    // Add broadcast unread count
    const { getUnreadBroadcastCount } = require('../broadcast-notification/broadcast-notification.service');
    const broadcastUnread = await getUnreadBroadcastCount(userId, userRole);

    return personalUnread + broadcastUnread;
};

const markAsRead = async (notificationId, userId, isBroadcast = false) => {
    if (isBroadcast) {
        // Mark broadcast as read
        const { markBroadcastAsRead } = require('../broadcast-notification/broadcast-notification.service');
        return markBroadcastAsRead(userId, notificationId);
    }

    // Mark personal notification as read
    return Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true },
        { new: true }
    );
};

const markAllAsRead = async (userId, userRole = 'user') => {
    // Mark all personal notifications as read
    await Notification.updateMany({ userId, read: false }, { read: true });

    // Mark all broadcasts as read
    const { markAllBroadcastsAsRead } = require('../broadcast-notification/broadcast-notification.service');
    await markAllBroadcastsAsRead(userId, userRole);

    return { success: true };
};

const deleteNotification = async (notificationId, userId) => {
    return Notification.findOneAndDelete({ _id: notificationId, userId });
};

// Create system notification for all users (except admins)
const createSystemNotification = async ({ type, content, meta = {} }) => {
    try {
        const User = require('../user/user.model');

        // Get all non-admin users
        const users = await User.find({ role: { $ne: 'admin' } }, '_id').lean();
        console.log(`[Notification Service] Found ${users.length} non-admin users for system notification`);

        if (users.length === 0) {
            console.log('[Notification Service] No users to notify');
            return {
                success: true,
                count: 0,
                message: 'No users to notify',
                notifications: []
            };
        }

        // Create notifications for all users
        const notificationsData = users.map(user => ({
            userId: user._id,
            senderId: null, // System notification
            type,
            content,
            meta,
            read: false
        }));

        const insertedNotifications = await Notification.insertMany(notificationsData);
        console.log(`[Notification Service] Created ${insertedNotifications.length} notifications in database`);

        return {
            success: true,
            count: users.length,
            message: `Created ${users.length} notifications`,
            notifications: insertedNotifications
        };
    } catch (error) {
        console.error('[Notification Service] Error creating system notification:', error);
        return {
            success: false,
            count: 0,
            message: 'Failed to create system notifications',
            notifications: []
        };
    }
};

module.exports = {
    createNotification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createSystemNotification
};
