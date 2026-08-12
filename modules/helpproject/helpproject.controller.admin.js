const service = require('./helpproject.service.admin');

const getAllProjects = async (req, res) => {
    try {
        const result = await service.getAllProjects({
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
        console.error('Get all projects admin error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy danh sách dự án' });
    }
};

const getProjectById = async (req, res) => {
    try {
        const project = await service.getProjectById(req.params.id);
        res.json({ success: true, data: project });
    } catch (error) {
        console.error('Get project admin error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy dự án' });
    }
};

const deleteProject = async (req, res) => {
    try {
        await service.deleteProject(req.params.id);
        res.json({ success: true, message: 'Xóa dự án thành công' });
    } catch (error) {
        console.error('Delete project admin error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi xóa dự án' });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'answered'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }
        const project = await service.updateStatus(req.params.id, status);
        res.json({ success: true, data: project, message: 'Cập nhật trạng thái thành công' });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi cập nhật trạng thái' });
    }
};

const getStatistics = async (req, res) => {
    try {
        const stats = await service.getStatistics();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy thống kê' });
    }
};

const addReply = async (req, res) => {
    try {
        const { content, parentId } = req.body;
        if (!content?.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung phản hồi' });
        }
        const project = await service.addReply(req.params.id, req.userId, content, parentId || null);
        res.json({ success: true, data: project, message: 'Gửi phản hồi thành công' });
    } catch (error) {
        console.error('Admin add reply error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi gửi phản hồi' });
    }
};

module.exports = {
    getAllProjects,
    getProjectById,
    deleteProject,
    updateStatus,
    getStatistics,
    addReply,
};
