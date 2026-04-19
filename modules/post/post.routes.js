const express = require('express');
const router = express.Router();
const postController = require('./post.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

router.get('/', optionalAuth, postController.getAllPosts);
router.get('/user', authenticate, postController.getUserPosts);
router.get('/:slug', optionalAuth, postController.getPostBySlug);
router.post('/:slug/view', optionalAuth, postController.trackPostView);

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

module.exports = router;