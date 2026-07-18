const HelpProject = require('./helpproject.model');
const Notification = require('../notification/notification.model');
const User = require('../user/user.model');
const socketService = require('../../services/socket.service');

function getIo() {
    try {
        return socketService.getIO();
    } catch (e) {
        console.error('❌ HelpProject getIo error:', e.message);
        return null;
    }
}

async function createProject(userId, data) {
    const project = new HelpProject({
        userId,
        title: data.title,
        thumbnail: data.thumbnail || '',
        content: data.content
    });
    await project.save();
    await project.populate('userId', 'fullName email avatar');

    // Send notification to all admins
    const admins = await User.find({ role: 'admin' }).select('_id');
    const adminIds = admins.map(admin => admin._id);
    const io = getIo();

    if (adminIds.length > 0) {
        const user = await User.findById(userId).select('fullName');
        const notificationContent = `${user?.fullName || 'Người dùng'} vừa gửi dự án mới: "${data.title.substring(0, 50)}${data.title.length > 50 ? '...' : ''}"`;

        const notifications = await Notification.insertMany(
            adminIds.map(adminId => ({
                userId: adminId,
                senderId: userId,
                type: 'system',
                content: notificationContent,
                meta: { projectId: project._id, title: data.title },
                read: false,
                createdAt: new Date(),
                updatedAt: new Date()
            }))
        );

        if (io) {
            console.log(`📢 Sending project notification to ${adminIds.length} admin(s)`);
            notifications.forEach((notification, index) => {
                const adminId = adminIds[index].toString();
                io.to(adminId).emit('new_notification', {
                    _id: notification._id,
                    userId: notification.userId,
                    senderId: userId,
                    type: 'system',
                    content: notificationContent,
                    meta: { projectId: project._id, title: data.title },
                    read: false,
                    createdAt: notification.createdAt
                });
            });
            console.log('✅ Project notifications sent');
        }
    }

    return project;
}

async function getUserProjects(userId, { page = 1, limit = 10, status = 'all', search = '' }) {
    const query = { userId };

    if (status && status !== 'all') {
        query.status = status;
    }

    if (search && search.trim() !== '') {
        query.$or = [
            {
                title: {
                    $regex: search.trim(),
                    $options: 'i'
                }
            },
            {
                content: {
                    $regex: search.trim(),
                    $options: 'i'
                }
            }
        ];
    }

    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
        HelpProject.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'fullName email avatar')
            .populate('replies.userId', 'fullName email avatar'),

        HelpProject.countDocuments(query)
    ]);

    return {
        projects,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    };
}

async function getProjectById(projectId) {
    await HelpProject.findByIdAndUpdate(projectId, { $inc: { viewCount: 1 } });
    const project = await HelpProject.findById(projectId)
        .populate('userId', 'fullName email avatar')
        .populate('replies.userId', 'fullName email avatar');
    if (!project) throw new Error('Không tìm thấy dự án');
    return project;
}

async function updateProject(projectId, userId, data) {
    const project = await HelpProject.findOne({ _id: projectId, userId });
    if (!project) throw new Error('Không tìm thấy dự án hoặc bạn không có quyền');

    if (data.title !== undefined) project.title = data.title;
    if (data.thumbnail !== undefined) project.thumbnail = data.thumbnail;
    if (data.content !== undefined) project.content = data.content;

    await project.save();
    return project;
}

async function deleteProject(projectId, userId) {
    const project = await HelpProject.findOne({ _id: projectId, userId });
    if (!project) throw new Error('Không tìm thấy dự án hoặc bạn không có quyền');
    await project.deleteOne();
    return true;
}

async function addReply(projectId, userId, content, userRole) {
    const project = await HelpProject.findById(projectId).populate('userId', '_id fullName');
    if (!project) throw new Error('Không tìm thấy dự án');

    project.replies.push({ userId, content });
    project.status = 'answered';
    await project.save();

    const updatedProject = await HelpProject.findById(projectId)
        .populate('userId', 'fullName email avatar')
        .populate('replies.userId', 'fullName email avatar');

    // Send notification
    const replier = await User.findById(userId).select('fullName');
    const io = getIo();

    // Determine who to notify
    let recipientId = null;
    let notificationContent = '';

    if (userRole === 'admin') {
        // Admin replied -> notify project owner
        recipientId = typeof project.userId === 'object' ? project.userId._id.toString() : project.userId.toString();
        notificationContent = `Admin ${replier?.fullName || 'Quản trị viên'} đã phản hồi dự án của bạn: "${project.title.substring(0, 40)}${project.title.length > 40 ? '...' : ''}"`;
    } else {
        // User replied -> notify all admins
        const admins = await User.find({ role: 'admin' }).select('_id');
        const adminIds = admins.map(admin => admin._id);

        if (adminIds.length > 0) {
            notificationContent = `${replier?.fullName || 'Người dùng'} đã phản hồi dự án: "${project.title.substring(0, 40)}${project.title.length > 40 ? '...' : ''}"`;

            const notifications = await Notification.insertMany(
                adminIds.map(adminId => ({
                    userId: adminId,
                    senderId: userId,
                    type: 'system',
                    content: notificationContent,
                    meta: { projectId: project._id, title: project.title },
                    read: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }))
            );

            if (io) {
                console.log(`💬 Sending reply notification to ${adminIds.length} admin(s)`);
                notifications.forEach((notification, index) => {
                    const adminId = adminIds[index].toString();
                    io.to(adminId).emit('new_notification', {
                        _id: notification._id,
                        userId: notification.userId,
                        senderId: userId,
                        type: 'system',
                        content: notificationContent,
                        meta: { projectId: project._id, title: project.title },
                        read: false,
                        createdAt: notification.createdAt
                    });
                });
            }
        }

        return updatedProject;
    }

    // If admin replied to user
    if (recipientId && recipientId !== userId.toString()) {
        const notification = await Notification.create({
            userId: recipientId,
            senderId: userId,
            type: 'system',
            content: notificationContent,
            meta: { projectId: project._id, title: project.title },
            read: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        if (io) {
            console.log(`💬 Sending admin reply notification to user: ${recipientId}`);
            io.to(recipientId).emit('new_notification', {
                _id: notification._id,
                userId: recipientId,
                senderId: userId,
                type: 'system',
                content: notificationContent,
                meta: { projectId: project._id, title: project.title },
                read: false,
                createdAt: notification.createdAt
            });
        }
    }

    return updatedProject;
}

module.exports = {
    createProject,
    getUserProjects,
    getProjectById,
    updateProject,
    deleteProject,
    addReply,
};
