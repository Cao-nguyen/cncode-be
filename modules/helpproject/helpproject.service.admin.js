const HelpProject = require('./helpproject.model');
const User = require('../user/user.model');

async function getAllProjects({ page = 1, limit = 10, status = 'all', search = '' }) {
    const query = {};
    if (status !== 'all') query.status = status;
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { content: { $regex: search, $options: 'i' } }
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

    return { projects, total, page, totalPages: Math.ceil(total / limit) };
}

async function getProjectById(projectId) {
    await HelpProject.findByIdAndUpdate(projectId, { $inc: { viewCount: 1 } });
    const project = await HelpProject.findById(projectId)
        .populate('userId', 'fullName email avatar')
        .populate('replies.userId', 'fullName email avatar');
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
    return project;
}

async function getStatistics() {
    const [total, pending, answered] = await Promise.all([
        HelpProject.countDocuments(),
        HelpProject.countDocuments({ status: 'pending' }),
        HelpProject.countDocuments({ status: 'answered' })
    ]);
    return { total, pending, answered };
}

module.exports = {
    getAllProjects,
    getProjectById,
    deleteProject,
    updateStatus,
    getStatistics,
};
