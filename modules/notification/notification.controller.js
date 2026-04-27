const notificationService = require('./notification.service');

const getMyNotifications = async (req, res) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const data = await notificationService.getNotifications(userId, page, limit);

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const userId = req.userId;
        const unreadCount = await notificationService.getUnreadCount(userId);
        res.status(200).json({ success: true, data: { unreadCount } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.userId;
        await notificationService.markAsRead(notificationId, userId);
        res.status(200).json({ success: true, message: 'Marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        const userId = req.userId;
        await notificationService.markAllAsRead(userId);
        res.status(200).json({ success: true, message: 'All marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.userId;
        await notificationService.deleteNotification(notificationId, userId);
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
};