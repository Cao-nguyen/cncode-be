const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const {
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
} = require('./blog.controller.user');

// Public routes
router.get('/', getBlogs);
router.post('/increment-view/:slug', incrementViewCount);
router.get('/:slug', getBlogBySlug);
router.get('/:slug/related', getRelatedBlogs);

// User routes (require authentication)
router.post('/my/create', authenticate, createBlog);
router.get('/my/blogs', authenticate, getMyBlogs);
router.get('/my/bookmarks', authenticate, getMyBookmarkedBlogs);
router.get('/my/:id', authenticate, getMyBlogById);
router.put('/my/:id', authenticate, updateBlog);
router.delete('/my/:id', authenticate, deleteBlog);
router.post('/:id/like', authenticate, toggleLikeBlog);
router.post('/:id/bookmark', authenticate, toggleBookmarkBlog);
router.get('/:id/interaction', authenticate, checkBlogInteraction);

module.exports = router;
