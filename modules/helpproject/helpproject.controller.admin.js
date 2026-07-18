const service = require('./helpproject.service.admin');

const getAllProjects = async (req, res) => {
    try {
        const { page, limit, status, search } = req.query;
        const result = await service.getAllProjects({
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

const deleteProject = async (req, res) => {
    try {
        await service.deleteProject(req.params.id);
        res.json({ success: true, message: 'Xóa dự án thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const project = await service.updateStatus(req.params.id, status);
        res.json({ success: true, data: project });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getStatistics = async (req, res) => {
    try {
        const stats = await service.getStatistics();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllProjects,
    getProjectById,
    deleteProject,
    updateStatus,
    getStatistics,
};
