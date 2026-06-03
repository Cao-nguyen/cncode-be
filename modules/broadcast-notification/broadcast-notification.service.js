const BroadcastNotification = require('./broadcast-notification.model');
const BroadcastReadStatus = require('./broadcast-read-status.model');

// Tạo broadcast notification (chỉ 1 document)
const createBroadcastNotification = async ({
    type,
    title,
    content,
    meta = {},
    targetAudience = 'all',
    createdBy = null
}) => {
    try {
        const broadcast = await BroadcastNotification.create({
            type,
            title,
            content,
            meta,
            targetAudience,
            createdBy
        });

        console.log(`[Broadcast Service] Created broadcast notification: ${broadcast._id}`);
        return {
            success: true,
            broadcast
        };
    } catch (error) {
        console.error('[Broadcast Service] Error creating broadcast:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Lấy broadcasts cho user (chưa đọc + trong 15 ngày)
const getBroadcastsForUser = async (userId, userRole = 'user') => {
    try {
        // Xác định target audience dựa trên role
        const audienceFilter = userRole === 'admin'
            ? [] // Admin không nhận broadcast
            : ['all'];

        if (userRole === 'teacher') {
            audienceFilter.push('teachers_only');
        } else if (userRole === 'user') {
            audienceFilter.push('users_only');
        }

        // Lấy broadcasts trong 15 ngày
        const broadcasts = await BroadcastNotification.find({
            targetAudience: { $in: audienceFilter },
            createdAt: { $gte: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }
        })
            .sort({ createdAt: -1 })
            .lean();

        if (broadcasts.length === 0) {
            return [];
        }

        // Lấy danh sách broadcasts đã đọc
        const broadcastIds = broadcasts.map(b => b._id);
        const readStatuses = await BroadcastReadStatus.find({
            userId,
            broadcastId: { $in: broadcastIds }
        }).lean();

        const readBroadcastIds = new Set(
            readStatuses.map(rs => rs.broadcastId.toString())
        );

        // Thêm trạng thái read vào mỗi broadcast
        return broadcasts.map(broadcast => ({
            ...broadcast,
            read: readBroadcastIds.has(broadcast._id.toString())
        }));

    } catch (error) {
        console.error('[Broadcast Service] Error getting broadcasts:', error);
        return [];
    }
};

// Đếm số broadcasts chưa đọc
const getUnreadBroadcastCount = async (userId, userRole = 'user') => {
    try {
        if (userRole === 'admin') return 0;

        const audienceFilter = ['all'];
        if (userRole === 'teacher') {
            audienceFilter.push('teachers_only');
        } else if (userRole === 'user') {
            audienceFilter.push('users_only');
        }

        // Đếm total broadcasts
        const totalBroadcasts = await BroadcastNotification.countDocuments({
            targetAudience: { $in: audienceFilter },
            createdAt: { $gte: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }
        });

        // Đếm đã đọc
        const readCount = await BroadcastReadStatus.countDocuments({
            userId,
            broadcastId: {
                $in: await BroadcastNotification.find({
                    targetAudience: { $in: audienceFilter },
                    createdAt: { $gte: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }
                }).distinct('_id')
            }
        });

        return totalBroadcasts - readCount;
    } catch (error) {
        console.error('[Broadcast Service] Error counting unread:', error);
        return 0;
    }
};

// Đánh dấu đã đọc
const markBroadcastAsRead = async (userId, broadcastId) => {
    try {
        // Upsert: Tạo nếu chưa có, ignore nếu đã có
        await BroadcastReadStatus.findOneAndUpdate(
            { userId, broadcastId },
            { userId, broadcastId, readAt: new Date() },
            { upsert: true, new: true }
        );

        return { success: true };
    } catch (error) {
        // Ignore duplicate key error (user đã đọc rồi)
        if (error.code === 11000) {
            return { success: true };
        }
        console.error('[Broadcast Service] Error marking as read:', error);
        return { success: false, error: error.message };
    }
};

// Đánh dấu tất cả đã đọc
const markAllBroadcastsAsRead = async (userId, userRole = 'user') => {
    try {
        if (userRole === 'admin') return { success: true, count: 0 };

        const audienceFilter = ['all'];
        if (userRole === 'teacher') {
            audienceFilter.push('teachers_only');
        } else if (userRole === 'user') {
            audienceFilter.push('users_only');
        }

        // Lấy tất cả broadcast IDs
        const broadcasts = await BroadcastNotification.find({
            targetAudience: { $in: audienceFilter },
            createdAt: { $gte: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }
        }).distinct('_id');

        // Tạo read status cho tất cả (ignore duplicates)
        const operations = broadcasts.map(broadcastId => ({
            updateOne: {
                filter: { userId, broadcastId },
                update: { $set: { userId, broadcastId, readAt: new Date() } },
                upsert: true
            }
        }));

        if (operations.length > 0) {
            await BroadcastReadStatus.bulkWrite(operations, { ordered: false });
        }

        return { success: true, count: operations.length };
    } catch (error) {
        console.error('[Broadcast Service] Error marking all as read:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    createBroadcastNotification,
    getBroadcastsForUser,
    getUnreadBroadcastCount,
    markBroadcastAsRead,
    markAllBroadcastsAsRead
};