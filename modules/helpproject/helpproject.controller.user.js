const service = require('./helpproject.service.user');

const createProject = async (req, res) => {
    try {
        const project = await service.createProject(req.userId, req.body);
        res.status(201).json({ success: true, data: project, message: 'Gửi dự án thành công' });
    } catch (error) {
        console.error('Create help project error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi tạo dự án' });
    }
};

const getUserProjects = async (req, res) => {
    try {
        const result = await service.getUserProjects(req.userId, {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            status: req.query.status,
            search: req.query.search,
        });

        res.json({
            success: true,
            data: result.projects,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Get user projects error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy danh sách dự án' });
    }
};

const getUserProjectStats = async (req, res) => {
    try {
        const stats = await service.getUserProjectStats(req.userId);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get user project stats error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy thống kê' });
    }
};

const getProjectById = async (req, res) => {
    try {
        const project = await service.getProjectById(req.params.id, req.userId, req.userRole);
        res.json({ success: true, data: project });
    } catch (error) {
        console.error('Get project by id error:', error);
        const status = error.message.includes('quyền') ? 403 : 404;
        res.status(status).json({ success: false, message: error.message || 'Không tìm thấy dự án' });
    }
};

const incrementViewCount = async (req, res) => {
    try {
        const result = await service.incrementViewCount(req.params.id, req.userId, req.userRole);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Increment help project view error:', error);
        const status = error.message.includes('quyền') ? 403 : 404;
        res.status(status).json({ success: false, message: error.message || 'Không thể cập nhật lượt xem' });
    }
};

const updateProject = async (req, res) => {
    try {
        const project = await service.updateProject(req.params.id, req.userId, req.body);
        res.json({ success: true, data: project, message: 'Cập nhật dự án thành công' });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi cập nhật dự án' });
    }
};

const deleteProject = async (req, res) => {
    try {
        await service.deleteProject(req.params.id, req.userId);
        res.json({ success: true, message: 'Xóa dự án thành công' });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi xóa dự án' });
    }
};

const addReply = async (req, res) => {
    try {
        const { content, parentId } = req.body;
        if (!content?.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung phản hồi' });
        }
        const project = await service.addReply(req.params.id, req.userId, content, req.userRole, parentId || null);
        res.json({ success: true, data: project, message: 'Gửi phản hồi thành công' });
    } catch (error) {
        console.error('Add reply error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi gửi phản hồi' });
    }
};

module.exports = {
    createProject,
    getUserProjects,
    getUserProjectStats,
    getProjectById,
    incrementViewCount,
    updateProject,
    deleteProject,
    addReply,
};
