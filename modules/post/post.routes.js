const express = require('express');
const router = express.Router();
const postController = require('./post.controller');
const { authenticate, optionalAuth, adminAuth } = require('../../middleware/auth.middleware');

// ============= PUBLIC ROUTES (không cần đăng nhập) =============
router.get('/', optionalAuth, postController.getAllPosts);
router.get('/featured', optionalAuth, postController.getFeaturedBlogs);
router.post('/:slug/view', optionalAuth, postController.trackPostView);
router.get('/:slug', optionalAuth, postController.getPostBySlug); // Route động để cuối public routes

// ============= USER ROUTES (cần đăng nhập) =============
router.use(authenticate); // Tất cả các route phía dưới đều cần authenticate

router.get('/user', postController.getUserPosts);
router.get('/post/:id', postController.getPostById);
router.post('/', postController.createPost);
router.put('/:id', postController.updatePost);
router.delete('/:id', postController.deletePost);
router.post('/:id/like', postController.likePost);
router.post('/:id/bookmark', postController.bookmarkPost);
router.post('/:id/report', postController.reportPost);
router.post('/:id/comment', postController.addComment);
router.patch('/:id/comment/:commentId', postController.editComment);
router.delete('/:id/comment/:commentId', postController.deleteComment);
router.post('/:id/comment/:commentId/reaction', postController.toggleCommentReaction);
router.post('/:id/comment/:commentId/report', postController.reportComment);

// ============= ADMIN ROUTES =============
// Admin routes cần authenticate TRƯỚC, sau đó mới adminAuth
router.get('/admin/posts', authenticate, adminAuth, postController.adminGetAllPosts);
router.get('/admin/posts/:id', authenticate, adminAuth, postController.adminGetPostById);
router.put('/admin/posts/:id', authenticate, adminAuth, postController.adminUpdatePost);
router.patch('/admin/posts/:id/review', authenticate, adminAuth, postController.adminReviewPost);

module.exports = router;