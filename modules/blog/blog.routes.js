const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const {
    getBlogs,
    getBlogBySlug,
    incrementViewCount,
    getRelatedBlogs,
    getBlogStats,
    getBlogGrowthChart,
    getTopViewedBlogs,
    getTopLikedBlogs,
    getAllBlogsAdmin,
    getBlogById,
    createBlog,
    updateBlog,
    deleteBlog,
    togglePublish,
    toggleLikeBlog,
    toggleBookmarkBlog,
    checkBlogInteraction,
    getMyBlogs,
    getMyBookmarkedBlogs
} = require('./blog.controller');

// Admin routes (phải đặt trước các route có param động)
router.get('/admin/stats', authenticate, authorize('admin'), getBlogStats);
router.get('/admin/growth-chart', authenticate, authorize('admin'), getBlogGrowthChart);
router.get('/admin/top-viewed', authenticate, authorize('admin'), getTopViewedBlogs);
router.get('/admin/top-liked', authenticate, authorize('admin'), getTopLikedBlogs);
router.get('/admin/all', authenticate, authorize('admin'), getAllBlogsAdmin);
router.get('/admin/:id', authenticate, authorize('admin'), getBlogById);
router.post('/admin', authenticate, authorize('admin'), createBlog);
router.put('/admin/:id', authenticate, authorize('admin'), updateBlog);
router.delete('/admin/:id', authenticate, authorize('admin'), deleteBlog);
router.patch('/admin/:id/publish', authenticate, authorize('admin'), togglePublish);

// User routes (require authentication)
router.post('/my/create', authenticate, createBlog); // User tạo blog (chờ admin duyệt)
router.get('/my/blogs', authenticate, getMyBlogs);
router.get('/my/bookmarks', authenticate, getMyBookmarkedBlogs);
router.post('/:id/like', authenticate, toggleLikeBlog);
router.post('/:id/bookmark', authenticate, toggleBookmarkBlog);
router.get('/:id/interaction', authenticate, checkBlogInteraction);

// Public routes
router.get('/', getBlogs);
router.post('/increment-view/:slug', incrementViewCount);
router.get('/:slug', getBlogBySlug);
router.get('/:slug/related', getRelatedBlogs);

module.exports = router;
