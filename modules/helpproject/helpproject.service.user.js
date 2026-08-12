const { HelpProject } = require('./helpproject.model');
const Notification = require('../notification/notification.model');
const User = require('../user/user.model');
const socketService = require('../../services/socket.service');
const { recordUniqueView } = require('../../utils/uniqueView');

const USER_POPULATE = 'fullName email avatar role';
const REPLY_POPULATE = { path: 'replies.userId', select: 'fullName email avatar role' };

function getIo() {
    try {
        return socketService.getIO();
    } catch (e) {
        console.error('HelpProject getIo error:', e.message);
        return null;
    }
}

function buildSearchQuery(search) {
    if (!search?.trim()) return null;
    const term = search.trim();
    return {
        $or: [
            { title: { $regex: term, $options: 'i' } },
            { content: { $regex: term, $options: 'i' } },
        ],
    };
}

async function notifyAdmins({ senderId, content, meta }) {
    const admins = await User.find({ role: 'admin' }).select('_id');
    if (!admins.length) return;

    const notifications = await Notification.insertMany(
        admins.map((admin) => ({
            userId: admin._id,
            senderId,
            type: 'system',
            content,
            meta,
            read: false,
        }))
    );

    const io = getIo();
    if (!io) return;

    notifications.forEach((notification, index) => {
        io.to(admins[index]._id.toString()).emit('new_notification', notification);
    });
}

async function notifyUser({ userId, senderId, content, meta }) {
    const notification = await Notification.create({
        userId,
        senderId,
        type: 'system',
        content,
        meta,
        read: false,
    });

    const io = getIo();
    if (io) {
        io.to(userId.toString()).emit('new_notification', notification);
    }
}

async function populateProject(query) {
    return query
        .populate('userId', USER_POPULATE)
        .populate(REPLY_POPULATE);
}

async function assertCanViewProject(projectId, userId, userRole) {
    const project = await HelpProject.findById(projectId).select('userId isPublic');
    if (!project) {
        const err = new Error('Không tìm thấy dự án');
        err.statusCode = 404;
        throw err;
    }

    const ownerId = project.userId?.toString();
    const isOwner = ownerId === userId?.toString();
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin && !project.isPublic) {
        const err = new Error('Bạn không có quyền xem dự án này');
        err.statusCode = 403;
        throw err;
    }

    return project;
}

function buildAccessibleQuery(userId, { status = 'all', search = '' } = {}) {
    const clauses = [
        {
            $or: [
                { userId },
                { isPublic: true },
            ],
        },
    ];

    if (status && status !== 'all') {
        clauses.push({ status });
    }

    const searchQuery = buildSearchQuery(search);
    if (searchQuery) clauses.push(searchQuery);

    return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

async function createProject(userId, data) {
    const project = await HelpProject.create({
        userId,
        title: data.title,
        thumbnail: data.thumbnail || '',
        content: data.content,
        isPublic: data.isPublic === true,
    });

    const populated = await populateProject(HelpProject.findById(project._id));
    const user = await User.findById(userId).select('fullName');

    await notifyAdmins({
        senderId: userId,
        content: `${user?.fullName || 'Người dùng'} vừa gửi dự án mới: "${data.title.substring(0, 50)}${data.title.length > 50 ? '...' : ''}"`,
        meta: {
            projectId: project._id,
            title: data.title,
            url: `/hotroduan/${project._id}`,
        },
    });

    return populated;
}

async function getUserProjects(userId, { page = 1, limit = 10, status = 'all', search = '' } = {}) {
    const query = buildAccessibleQuery(userId, { status, search });

    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
        populateProject(
            HelpProject.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
        ),
        HelpProject.countDocuments(query),
    ]);

    return {
        projects,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
}

async function getUserProjectStats(userId) {
    const [total, pending, answered] = await Promise.all([
        HelpProject.countDocuments({ userId }),
        HelpProject.countDocuments({ userId, status: 'pending' }),
        HelpProject.countDocuments({ userId, status: 'answered' }),
    ]);

    return { total, pending, answered };
}

async function getProjectById(projectId, userId, userRole) {
    await assertCanViewProject(projectId, userId, userRole);
    const project = await populateProject(HelpProject.findById(projectId));
    if (!project) throw new Error('Không tìm thấy dự án');
    return project;
}

async function incrementViewCount(projectId, userId, userRole) {
    const project = await assertCanViewProject(projectId, userId, userRole);

    if (!userId) {
        throw new Error('Thiếu thông tin người xem');
    }

    return recordUniqueView({
        targetType: 'help_project',
        targetId: project._id,
        userId,
        incrementFn: async () => {
            await HelpProject.findByIdAndUpdate(projectId, { $inc: { viewCount: 1 } });
        },
        getViewsFn: async () => {
            const doc = await HelpProject.findById(projectId).select('viewCount').lean();
            return doc?.viewCount || 0;
        },
    });
}

async function updateProject(projectId, userId, data) {
    const project = await HelpProject.findOne({ _id: projectId, userId });
    if (!project) throw new Error('Không tìm thấy dự án hoặc bạn không có quyền');

    if (data.title !== undefined) project.title = data.title;
    if (data.thumbnail !== undefined) project.thumbnail = data.thumbnail;
    if (data.content !== undefined) project.content = data.content;
    if (data.isPublic !== undefined) project.isPublic = data.isPublic === true;

    await project.save();
    return populateProject(HelpProject.findById(project._id));
}

async function deleteProject(projectId, userId) {
    const project = await HelpProject.findOne({ _id: projectId, userId });
    if (!project) throw new Error('Không tìm thấy dự án hoặc bạn không có quyền');
    await project.deleteOne();
    return true;
}

async function addReply(projectId, userId, content, userRole, parentId = null) {
    await assertCanViewProject(projectId, userId, userRole);

    const project = await HelpProject.findById(projectId).populate('userId', '_id fullName');
    if (!project) throw new Error('Không tìm thấy dự án');

    if (parentId) {
        const parentExists = project.replies.some((r) => r._id.toString() === parentId.toString());
        if (!parentExists) throw new Error('Phản hồi gốc không tồn tại');
    }

    const replyPayload = { userId, content };
    if (parentId) replyPayload.parentId = parentId;

    project.replies.push(replyPayload);
    if (userRole === 'admin') {
        project.status = 'answered';
    }
    await project.save();

    const updatedProject = await populateProject(HelpProject.findById(projectId));
    const replier = await User.findById(userId).select('fullName role');

    const shortTitle = project.title.substring(0, 40) + (project.title.length > 40 ? '...' : '');

    if (userRole === 'admin') {
        const ownerId = project.userId?._id?.toString() || project.userId?.toString();
        if (ownerId && ownerId !== userId.toString()) {
            await notifyUser({
                userId: ownerId,
                senderId: userId,
                content: `Admin ${replier?.fullName || ''} đã phản hồi dự án của bạn: "${shortTitle}"`,
                meta: {
                    projectId: project._id,
                    title: project.title,
                    url: `/hotroduan/${project._id}`,
                },
            });
        }
    } else {
        await notifyAdmins({
            senderId: userId,
            content: `${replier?.fullName || 'Người dùng'} đã phản hồi dự án: "${shortTitle}"`,
            meta: {
                projectId: project._id,
                title: project.title,
                url: `/admin/hotroduan`,
            },
        });
    }

    return updatedProject;
}

module.exports = {
    createProject,
    getUserProjects,
    getUserProjectStats,
    getProjectById,
    incrementViewCount,
    assertCanViewProject,
    updateProject,
    deleteProject,
    addReply,
};
