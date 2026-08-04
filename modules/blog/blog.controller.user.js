const service = require('./blog.service.user');

const getBlogs = async (req, res) => {
    try {
        const { page = 1, limit = 12, category, search, sort = '-publishedAt' } = req.query;

        const result = await service.getBlogs(parseInt(page), parseInt(limit), category, search, sort);

        res.json({
            success: true,
            data: result.blogs,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get blogs error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getBlogBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const blog = await service.getBlogBySlug(slug);

        res.json({ success: true, data: blog });
    } catch (error) {
        console.error('Get blog by slug error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy bài viết' });
    }
};

const incrementViewCount = async (req, res) => {
    try {
        const { slug } = req.params;

        const viewCount = await service.incrementViewCount(slug);

        res.json({ success: true, viewCount });
    } catch (error) {
        console.error('Increment view count error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy bài viết' });
    }
};

const getRelatedBlogs = async (req, res) => {
    try {
        const { slug } = req.params;
        const { limit = 4 } = req.query;

        const blogs = await service.getRelatedBlogs(slug, parseInt(limit));

        res.json({ success: true, data: blogs });
    } catch (error) {
        console.error('Get related blogs error:', error);
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
        const userId = req.userId;
        const { id } = req.params;
        const { title, thumbnail, excerpt, content, category, tags, isPublished } = req.body;

        const blog = await service.updateBlog(id, userId, {
            title, thumbnail, excerpt, content, category, tags, isPublished
        });

        res.json({ success: true, data: blog, message: 'Cập nhật bài viết thành công' });
    } catch (error) {
        console.error('Update blog error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const deleteBlog = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        await service.deleteBlog(id, userId);

        res.json({ success: true, message: 'Xóa bài viết thành công' });
    } catch (error) {
        console.error('Delete blog error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const toggleLikeBlog = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const result = await service.toggleLikeBlog(id, userId);

        res.json({
            success: true,
            liked: result.liked,
            message: result.liked ? 'Đã thích bài viết' : 'Đã bỏ thích'
        });
    } catch (error) {
        console.error('Toggle like blog error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const toggleBookmarkBlog = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const result = await service.toggleBookmarkBlog(id, userId);

        res.json({
            success: true,
            bookmarked: result.bookmarked,
            message: result.bookmarked ? 'Đã lưu bài viết' : 'Đã bỏ lưu'
        });
    } catch (error) {
        console.error('Toggle bookmark blog error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const checkBlogInteraction = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const result = await service.checkBlogInteraction(id, userId);

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Check blog interaction error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getMyBlogs = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 12 } = req.query;

        const result = await service.getMyBlogs(userId, parseInt(page), parseInt(limit));

        res.json({
            success: true,
            data: result.blogs,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get my blogs error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getMyBookmarkedBlogs = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 12 } = req.query;

        const result = await service.getMyBookmarkedBlogs(userId, parseInt(page), parseInt(limit));

        res.json({
            success: true,
            data: result.blogs,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get bookmarked blogs error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getMyBlogById = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const blog = await service.getMyBlogById(id, userId);

        res.json({ success: true, data: blog });
    } catch (error) {
        console.error('Get my blog by ID error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy bài viết' });
    }
};

module.exports = {
    getBlogs,
    getBlogBySlug,
    incrementViewCount,
    getRelatedBlogs,
    createBlog,
    updateBlog,
    deleteBlog,
    toggleLikeBlog,
    toggleBookmarkBlog,
    checkBlogInteraction,
    getMyBlogs,
    getMyBookmarkedBlogs,
    getMyBlogById
};
