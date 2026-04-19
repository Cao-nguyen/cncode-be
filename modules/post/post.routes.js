const express = require('express');
const router = express.Router();
const postController = require('./post.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.get('/', authenticate, postController.getAllPosts);
router.get('/me', authenticate, postController.getUserPosts);
router.get('/:slug', authenticate, postController.getPostBySlug);
router.post('/', authenticate, postController.createPost);
router.put('/:id', authenticate, postController.updatePost);
router.delete('/:id', authenticate, postController.deletePost);
router.post('/:id/like', authenticate, postController.likePost);
router.post('/:id/comment', authenticate, postController.addComment);
router.delete('/:id/comment/:commentId', authenticate, postController.deleteComment);
router.post('/:id/comment/:commentId/reaction', authenticate, postController.toggleCommentReaction);

module.exports = router;