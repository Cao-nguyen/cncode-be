const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const {
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
} = require('./blog.controller.admin');

// Admin routes
router.get('/stats', authenticate, authorize('admin'), getStats);
router.get('/growth-chart', authenticate, authorize('admin'), getGrowthChart);
router.get('/top-viewed', authenticate, authorize('admin'), getTopViewedBlogs);
router.get('/top-liked', authenticate, authorize('admin'), getTopLikedBlogs);
router.get('/all', authenticate, authorize('admin'), getAllBlogs);
router.get('/:id', authenticate, authorize('admin'), getBlogById);
router.post('/', authenticate, authorize('admin'), createBlog);
router.put('/:id', authenticate, authorize('admin'), updateBlog);
router.delete('/:id', authenticate, authorize('admin'), deleteBlog);
router.patch('/:id/publish', authenticate, authorize('admin'), togglePublish);

module.exports = router;
