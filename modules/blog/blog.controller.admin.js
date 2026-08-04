const service = require('./blog.service.admin');

const getAllBlogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, category, isPublished } = req.query;

        const result = await service.getAllBlogs(parseInt(page), parseInt(limit), search, category, isPublished);

        res.json({
            success: true,
            data: result.blogs,
            stats: {
                byCategory: result.categoryStats,
                byStatus: result.publishStats
            },
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get all blogs admin error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getBlogById = async (req, res) => {
    try {
        const { id } = req.params;

        const blog = await service.getBlogById(id);

        res.json({ success: true, data: blog });
    } catch (error) {
        console.error('Get blog by ID error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy bài viết' });
    }
};

const createBlog = async (req, res) => {
    try {
        const userId = req.userId;
        const { title, thumbnail, excerpt, content, category, tags, isPublished } = req.body;

        const blog = await service.createBlog(userId, {
            title, thumbnail, excerpt, content, category, tags, isPublished
        });

        res.status(201).json({ success: true, data: blog, message: 'Tạo bài viết thành công' });
    } catch (error) {
        console.error('Create blog error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, thumbnail, excerpt, content, category, tags, isPublished, publishedAt, rejectionReason, needsReview } = req.body;

        const blog = await service.updateBlog(id, {
            title, thumbnail, excerpt, content, category, tags, isPublished, publishedAt, rejectionReason, needsReview
        });

        res.json({ success: true, data: blog, message: 'Cập nhật bài viết thành công' });
    } catch (error) {
        console.error('Update blog error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;

        await service.deleteBlog(id);

        res.json({ success: true, message: 'Xóa bài viết thành công' });
    } catch (error) {
        console.error('Delete blog error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy bài viết' });
    }
};

const togglePublish = async (req, res) => {
    try {
        const { id } = req.params;

        const blog = await service.togglePublish(id);

        res.json({
            success: true,
            data: blog,
            message: blog.isPublished ? 'Đã xuất bản bài viết' : 'Đã ẩn bài viết'
        });
    } catch (error) {
        console.error('Toggle publish error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy bài viết' });
    }
};

const getStats = async (req, res) => {
    try {
        const stats = await service.getStats();

        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get blog stats error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getGrowthChart = async (req, res) => {
    try {
        const { days = 10 } = req.query;

        const chartData = await service.getGrowthChart(parseInt(days));

        res.json({ success: true, data: chartData });
    } catch (error) {
        console.error('Get blog growth chart error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getTopViewedBlogs = async (req, res) => {
    try {
        const { limit = 5 } = req.query;

        const blogs = await service.getTopViewedBlogs(parseInt(limit));

        res.json({ success: true, data: blogs });
    } catch (error) {
        console.error('Get top viewed blogs error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getTopLikedBlogs = async (req, res) => {
    try {
        const { limit = 5 } = req.query;

        const blogs = await service.getTopLikedBlogs(parseInt(limit));

        res.json({ success: true, data: blogs });
    } catch (error) {
        console.error('Get top liked blogs error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

module.exports = {
    getAllBlogs,
    getBlogById,
    createBlog,
    updateBlog,
    deleteBlog,
    togglePublish,
    getStats,
    getGrowthChart,
    getTopViewedBlogs,
    getTopLikedBlogs
};
