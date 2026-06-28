const CrossPromotion = require('./cross-promotion.model');
const Notification = require('../notification/notification.model');
const User = require('../user/user.model');
const socketService = require('../../services/socket.service');

function getIo() {
    try {
        return socketService.getIO();
    } catch (e) {
        console.error('❌ CrossPromotion getIo error:', e.message);
        return null;
    }
}

const COOPERATION_LABELS = {
    'blog-post': 'Blog',
    'fanpage-post': 'Fanpage',
};

const STATUS_MESSAGES = {
    approved: 'Yêu cầu truyền thông chéo của bạn đã được duyệt',
    rejected: 'Yêu cầu truyền thông chéo của bạn đã bị từ chối',
    completed: 'Yêu cầu truyền thông chéo của bạn đã hoàn thành',
};

async function notifyAdminsNewRequest(request, requesterId) {
    const requester = await User.findById(requesterId).select('fullName avatar');
    const admins = await User.find({ role: 'admin' }).select('_id');
    const adminIds = admins.map((admin) => admin._id);

    if (adminIds.length === 0) return;

    const titlePreview = request.title.length > 50 ? `${request.title.substring(0, 50)}...` : request.title;
    const orgName = request.requesterInfo?.organizationName;
    const notificationContent = orgName
        ? `${requester?.fullName || 'Người dùng'} (${orgName}) vừa gửi yêu cầu truyền thông chéo [${COOPERATION_LABELS[request.cooperationType] || 'Hợp tác'}]: "${titlePreview}"`
        : `${requester?.fullName || 'Người dùng'} vừa gửi yêu cầu truyền thông chéo [${COOPERATION_LABELS[request.cooperationType] || 'Hợp tác'}]: "${titlePreview}"`;

    const notifications = await Notification.insertMany(
        adminIds.map((adminId) => ({
            userId: adminId,
            senderId: requesterId,
            type: 'cross_promotion_new',
            content: notificationContent,
            meta: {
                requestId: request._id,
                title: request.title,
                cooperationType: request.cooperationType,
                url: '/admin/truyenthongcheo',
            },
            read: false,
        }))
    );

    const io = getIo();
    if (!io) return;

    notifications.forEach((notification, index) => {
        const adminId = adminIds[index].toString();
        io.to(adminId).emit('new_notification', {
            _id: notification._id,
            userId: notification.userId,
            senderId: {
                _id: requesterId,
                fullName: requester?.fullName,
                avatar: requester?.avatar,
            },
            type: 'cross_promotion_new',
            content: notificationContent,
            meta: notification.meta,
            read: false,
            createdAt: notification.createdAt,
        });
    });

    io.emit('cross_promotion_created', request);
}

async function notifyUserStatusUpdate(request, adminId, status, message) {
    if (!STATUS_MESSAGES[status]) return;

    const admin = await User.findById(adminId).select('fullName avatar');
    const notificationContent = `${STATUS_MESSAGES[status]}${message ? `: ${message}` : ''}`;

    const notification = await Notification.create({
        userId: request.requester,
        senderId: adminId,
        type: 'cross_promotion_status_updated',
        content: notificationContent,
        meta: {
            requestId: request._id,
            title: request.title,
            status,
            message: message || '',
            url: '/truyenthongcheo',
        },
        read: false,
    });

    const io = getIo();
    if (!io) return;

    const userIdStr = request.requester.toString();

    io.to(userIdStr).emit('new_notification', {
        _id: notification._id,
        userId: notification.userId,
        senderId: {
            _id: adminId,
            fullName: admin?.fullName || 'Admin',
            avatar: admin?.avatar,
        },
        type: 'cross_promotion_status_updated',
        content: notificationContent,
        meta: notification.meta,
        read: false,
        createdAt: notification.createdAt,
    });

    io.to(userIdStr).emit('cross_promotion_status_changed', {
        requestId: request._id,
        status,
        message: message || '',
        adminResponse: request.adminResponse,
    });

    io.emit('cross_promotion_updated', request);
}

exports.createRequest = async (userId, data) => {
    const { title, content, cooperationType, requesterInfo } = data;

    const request = await CrossPromotion.create({
        title,
        content,
        cooperationType,
        requester: userId,
        requesterInfo: requesterInfo || {},
    });

    await request.populate('requester', 'fullName email avatar');

    await notifyAdminsNewRequest(request, userId);

    return request;
};

exports.updateRequestStatus = async (requestId, adminId, status, message = '') => {
    const request = await CrossPromotion.findById(requestId);
    if (!request) {
        throw new Error('Không tìm thấy yêu cầu');
    }

    request.status = status;
    request.adminResponse = {
        message: message || '',
        respondedBy: adminId,
        respondedAt: new Date(),
    };

    if (status === 'completed') {
        request.completedAt = new Date();
    }

    await request.save();
    await request.populate('requester', 'fullName email avatar');
    await request.populate('adminResponse.respondedBy', 'fullName email');

    await notifyUserStatusUpdate(request, adminId, status, message);

    return request;
};
