// modules/comment/comment.routes.js
const express = require('express');
const router = express.Router();
const commentController = require('./comment.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// ========== PUBLIC ROUTES (có thể có optional auth) ==========
router.get('/target/:targetType/:targetId', commentController.getCommentsByTarget);
router.get('/replies/:parentId', commentController.getRepliesByParent);

// ========== PROTECTED ROUTES ==========
router.use(authenticate);

// Comment CRUD
router.post('/', commentController.createComment);
router.put('/:id', commentController.updateComment);
router.delete('/:id', commentController.deleteComment);

// Reactions
router.post('/:id/react', commentController.reactToComment);
router.get('/:id/reactions', commentController.getReactionUsers);

// Reports
router.post('/:id/report', commentController.reportComment);

// ========== ADMIN ROUTES ==========
router.get('/admin/reports', authorize('admin'), commentController.getReports);
router.put('/admin/reports/:id/resolve', authorize('admin'), commentController.resolveReport);
router.delete('/admin/:id/hard', authorize('admin'), commentController.hardDeleteComment);

module.exports = router;