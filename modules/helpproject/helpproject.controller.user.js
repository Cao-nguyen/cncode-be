const service = require('./helpproject.service.user');

const createProject = async (req, res) => {
    try {
        const project = await service.createProject(req.userId, req.body);
        res.status(201).json({ success: true, data: project });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getUserProjects = async (req, res) => {
    try {
        const { page, limit, status, search } = req.query;

        const result = await service.getUserProjects(req.userId, {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
            status,
            search 
        });

        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getProjectById = async (req, res) => {
    try {
        const project = await service.getProjectById(req.params.id);
        res.json({ success: true, data: project });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

const updateProject = async (req, res) => {
    try {
        const project = await service.updateProject(req.params.id, req.userId, req.body);
        res.json({ success: true, data: project });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const deleteProject = async (req, res) => {
    try {
        await service.deleteProject(req.params.id, req.userId);
        res.json({ success: true, message: 'Xóa dự án thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const addReply = async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung phản hồi' });
        }
        const project = await service.addReply(req.params.id, req.userId, content, req.userRole);
        res.json({ success: true, data: project });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    createProject,
    getUserProjects,
    getProjectById,
    updateProject,
    deleteProject,
    addReply,
};
