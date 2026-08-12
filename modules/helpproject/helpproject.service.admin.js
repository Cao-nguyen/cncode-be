const { HelpProject } = require('./helpproject.model');
const Comment = require('../comment/comment.model');

const USER_POPULATE = 'fullName email avatar role';
const REPLY_POPULATE = { path: 'replies.userId', select: 'fullName email avatar role' };

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

async function populateProject(query) {
    return query
        .populate('userId', USER_POPULATE)
        .populate(REPLY_POPULATE);
}

async function attachCommentCounts(projects) {
    if (!projects.length) return [];

    const ids = projects.map((p) => p._id.toString());
    const counts = await Comment.aggregate([
        {
            $match: {
                targetType: 'help_project',
                targetId: { $in: ids },
                isDeleted: false,
            },
        },
        { $group: { _id: '$targetId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map(counts.map((item) => [item._id.toString(), item.count]));

    return projects.map((project) => {
        const doc = project.toObject ? project.toObject() : project;
        const projectId = doc._id.toString();
        return {
            ...doc,
            commentCount: countMap.get(projectId) || 0,
        };
    });
}

async function getAllProjects({ page = 1, limit = 10, status = 'all', search = '' } = {}) {
    const query = {};
    if (status && status !== 'all') query.status = status;

    const searchQuery = buildSearchQuery(search);
    if (searchQuery) Object.assign(query, searchQuery);

    const skip = (page - 1) * limit;

    const [rawProjects, total] = await Promise.all([
        populateProject(
            HelpProject.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
        ),
        HelpProject.countDocuments(query),
    ]);

    const projects = await attachCommentCounts(rawProjects);

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

async function getProjectById(projectId) {
    const project = await populateProject(HelpProject.findById(projectId));
    if (!project) throw new Error('Không tìm thấy dự án');
    return project;
}

async function deleteProject(projectId) {
    const project = await HelpProject.findById(projectId);
    if (!project) throw new Error('Không tìm thấy dự án');
    await project.deleteOne();
    return true;
}

async function updateStatus(projectId, status) {
    const project = await HelpProject.findById(projectId);
    if (!project) throw new Error('Không tìm thấy dự án');
    project.status = status;
    await project.save();
    return populateProject(HelpProject.findById(project._id));
}

async function getStatistics() {
    const [total, pending, answered, viewAgg] = await Promise.all([
        HelpProject.countDocuments(),
        HelpProject.countDocuments({ status: 'pending' }),
        HelpProject.countDocuments({ status: 'answered' }),
        HelpProject.aggregate([{ $group: { _id: null, totalViews: { $sum: '$viewCount' } } }]),
    ]);

    return {
        total,
        pending,
        answered,
        totalViews: viewAgg[0]?.totalViews || 0,
    };
}

async function addReply(projectId, adminId, content, parentId = null) {
    const userService = require('./helpproject.service.user');
    return userService.addReply(projectId, adminId, content, 'admin', parentId || null);
}

module.exports = {
    getAllProjects,
    getProjectById,
    deleteProject,
    updateStatus,
    getStatistics,
    addReply,
};
