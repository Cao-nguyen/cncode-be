const helpProjectService = require('./helpproject.service');

module.exports = {
    async createProject(req, res) {
        try {
            const project = await helpProjectService.createProject(req.userId, req.body);
            res.status(201).json({ success: true, data: project });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getUserProjects(req, res) {
        try {
            const { page, limit, status, search } = req.query;

            const result = await helpProjectService.getUserProjects(req.userId, {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                status,
                search // ✅ FIX
            });

            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getAllProjects(req, res) {
        try {
            const { page, limit, status, search } = req.query;
            const result = await helpProjectService.getAllProjects({
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                status,
                search
            });
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getProjectById(req, res) {
        try {
            const project = await helpProjectService.getProjectById(req.params.id);
            res.json({ success: true, data: project });
        } catch (error) {
            res.status(404).json({ success: false, message: error.message });
        }
    },

    async updateProject(req, res) {
        try {
            const project = await helpProjectService.updateProject(req.params.id, req.userId, req.body);
            res.json({ success: true, data: project });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async deleteProject(req, res) {
        try {
            await helpProjectService.deleteProject(req.params.id, req.userId, req.userRole === 'admin');
            res.json({ success: true, message: 'Xóa dự án thành công' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async addReply(req, res) {
        try {
            const { content } = req.body;
            if (!content) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung phản hồi' });
            }
            const project = await helpProjectService.addReply(req.params.id, req.userId, content, req.userRole);
            res.json({ success: true, data: project });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async updateStatus(req, res) {
        try {
            const { status } = req.body;
            const project = await helpProjectService.updateStatus(req.params.id, status);
            res.json({ success: true, data: project });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getStatistics(req, res) {
        try {
            const stats = await helpProjectService.getStatistics();
            res.json({ success: true, data: stats });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
};