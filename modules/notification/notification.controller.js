// modules/notification/notification.controller.js
const Notification = require('./notification.model');
const notificationService = require('./notification.service');

const ADMIN_ONLY_TYPES = [
    'role_request_pending',
    'new_user_registered',
    'post_reported',
    'comment_reported',
];

const getMyNotifications = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await notificationService.getNotifications(req.userId, page, limit);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ userId: req.userId, read: false });
        res.json({ success: true, data: { count } });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId: req.userId },
            { read: true, updatedAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
        }

        res.json({ success: true, data: notification });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.userId, read: false },
            { read: true, updatedAt: new Date() }
        );

        res.json({ success: true, message: 'Đã đánh dấu tất cả là đã đọc' });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const sendToUsers = async (req, res) => {
    try {
        const { userIds, title, content, type, meta } = req.body;

        if (!userIds || !userIds.length) {
            return res.status(400).json({ success: false, message: 'Danh sách người dùng không hợp lệ' });
        }

        if (!content) {
            return res.status(400).json({ success: false, message: 'Nội dung thông báo không được để trống' });
        }

        const notifications = await Notification.insertMany(
            userIds.map(userId => ({
                userId,
                title: title || 'Thông báo',
                content,
                type: type || 'system',
                meta: meta || {},
                read: false,
                createdAt: new Date(),
                updatedAt: new Date()
            }))
        );

        const io = req.app.get('io');
        if (io) {
            notifications.forEach(notification => {
                // Đánh dấu isAdminOnly để FE filter
                const isAdminOnly = ADMIN_ONLY_TYPES.includes(notification.type);

                io.to(notification.userId.toString()).emit('new_notification', {
                    _id: notification._id,
                    notificationId: notification._id.toString(),
                    userId: notification.userId,
                    type: notification.type,
                    title: notification.title,
                    content: notification.content,
                    meta: notification.meta,
                    read: notification.read,
                    isAdminOnly,
                    createdAt: notification.createdAt,
                    updatedAt: notification.updatedAt,
                });
            });
        }

        res.json({ success: true, data: notifications, message: `Đã gửi ${notifications.length} thông báo` });
    } catch (error) {
        console.error('sendToUsers error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;

        const result = await Notification.findOneAndDelete({ _id: notificationId, userId: req.userId });

        if (!result) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
        }

        res.json({ success: true, message: 'Xóa thông báo thành công' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    sendToUsers,
    deleteNotification,
    ADMIN_ONLY_TYPES,
};