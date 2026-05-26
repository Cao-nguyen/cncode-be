const HelpProject = require('./helpproject.model');

class HelpProjectService {
    async createProject(userId, data) {
        const project = new HelpProject({
            userId,
            title: data.title,
            thumbnail: data.thumbnail || '',
            content: data.content
        });
        await project.save();
        return await project.populate('userId', 'fullName email avatar');
    }

    async getUserProjects(
        userId,
        { page = 1, limit = 10, status = 'all', search = '' }
    ) {
        const query = { userId };

        // ===== STATUS FILTER =====
        if (status && status !== 'all') {
            query.status = status;
        }

        // ===== SEARCH FIX =====
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

    async getAllProjects({ page = 1, limit = 10, status = 'all', search = '' }) {
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

    async getProjectById(projectId) {
        await HelpProject.findByIdAndUpdate(projectId, { $inc: { viewCount: 1 } });
        const project = await HelpProject.findById(projectId)
            .populate('userId', 'fullName email avatar')
            .populate('replies.userId', 'fullName email avatar');
        if (!project) throw new Error('Không tìm thấy dự án');
        return project;
    }

    async updateProject(projectId, userId, data) {
        const project = await HelpProject.findOne({ _id: projectId, userId });
        if (!project) throw new Error('Không tìm thấy dự án hoặc bạn không có quyền');

        if (data.title !== undefined) project.title = data.title;
        if (data.thumbnail !== undefined) project.thumbnail = data.thumbnail;
        if (data.content !== undefined) project.content = data.content;

        await project.save();
        return project;
    }

    async deleteProject(projectId, userId, isAdmin = false) {
        const query = isAdmin ? { _id: projectId } : { _id: projectId, userId };
        const project = await HelpProject.findOne(query);
        if (!project) throw new Error('Không tìm thấy dự án hoặc bạn không có quyền');
        await project.deleteOne();
        return true;
    }

    async addReply(projectId, userId, content, userRole) {
        const project = await HelpProject.findById(projectId);
        if (!project) throw new Error('Không tìm thấy dự án');

        project.replies.push({ userId, content });
        project.status = 'answered';
        await project.save();

        return await HelpProject.findById(projectId)
            .populate('userId', 'fullName email avatar')
            .populate('replies.userId', 'fullName email avatar');
    }

    async updateStatus(projectId, status) {
        const project = await HelpProject.findById(projectId);
        if (!project) throw new Error('Không tìm thấy dự án');
        project.status = status;
        await project.save();
        return project;
    }

    async getStatistics() {
        const [total, pending, answered] = await Promise.all([
            HelpProject.countDocuments(),
            HelpProject.countDocuments({ status: 'pending' }),
            HelpProject.countDocuments({ status: 'answered' })
        ]);
        return { total, pending, answered };
    }
}

module.exports = new HelpProjectService();