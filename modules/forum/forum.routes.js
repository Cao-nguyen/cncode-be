const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');
const {
    createPost,
    getPosts,
    getPostById,
    getPostsByAuthor,
    updatePost,
    deletePost,
    toggleLikePost,
    togglePinPost,
    sharePost,
} = require('./forum.controller');

// Public routes
router.get('/', optionalAuth, getPosts);
router.get('/author/:authorId', getPostsByAuthor);
router.get('/:postId', getPostById);

// Protected routes
router.post('/', authenticate, createPost);
router.put('/:postId', authenticate, updatePost);
router.delete('/:postId', authenticate, deletePost);
router.post('/:postId/like', authenticate, toggleLikePost);
router.post('/:postId/pin', authenticate, togglePinPost);
router.post('/:postId/share', authenticate, sharePost);

module.exports = router;
