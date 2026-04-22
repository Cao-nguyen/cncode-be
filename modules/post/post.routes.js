const express = require('express');
const router = express.Router();
const postController = require('./post.controller');
const { authenticate, optionalAuth, adminAuth } = require('../../middleware/auth.middleware');

// ============= PUBLIC ROUTES (không cần đăng nhập) =============
router.get('/', optionalAuth, postController.getAllPosts);
router.get('/featured', optionalAuth, postController.getFeaturedBlogs);
router.post('/:slug/view', optionalAuth, postController.trackPostView);

// ============= USER ROUTES (cần đăng nhập) =============
// Đặt các route cụ thể TRƯỚC route động /:slug
router.get('/user', authenticate, postController.getUserPosts);
router.get('/post/:id', authenticate, postController.getPostById);
router.post('/', authenticate, postController.createPost);
router.put('/:id', authenticate, postController.updatePost);
router.delete('/:id', authenticate, postController.deletePost);
router.post('/:id/like', authenticate, postController.likePost);
router.post('/:id/bookmark', authenticate, postController.bookmarkPost);
router.post('/:id/report', authenticate, postController.reportPost);
router.post('/:id/comment', authenticate, postController.addComment);
router.patch('/:id/comment/:commentId', authenticate, postController.editComment);
router.delete('/:id/comment/:commentId', authenticate, postController.deleteComment);
router.post('/:id/comment/:commentId/reaction', authenticate, postController.toggleCommentReaction);
router.post('/:id/comment/:commentId/report', authenticate, postController.reportComment);

// Route động /:slug phải để SAU CÙNG
router.get('/:slug', optionalAuth, postController.getPostBySlug);

// ============= ADMIN ROUTES =============
router.get('/admin/posts', adminAuth, postController.adminGetAllPosts);
router.get('/admin/posts/:id', adminAuth, postController.adminGetPostById);
router.put('/admin/posts/:id', adminAuth, postController.adminUpdatePost);
router.patch('/admin/posts/:id/review', adminAuth, postController.adminReviewPost);

module.exports = router;