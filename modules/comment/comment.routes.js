
const express = require('express');
const router = express.Router();
const commentController = require('./comment.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/target/:targetType/:targetId', commentController.getCommentsByTarget);
router.get('/replies/:parentId', commentController.getRepliesByParent);

router.use(authenticate);

router.post('/', commentController.createComment);
router.put('/:id', commentController.updateComment);
router.delete('/:id', commentController.deleteComment);

router.post('/:id/react', commentController.reactToComment);
router.get('/:id/reactions', commentController.getReactionUsers);

router.post('/:id/report', commentController.reportComment);

router.get('/admin/reports', authorize('admin'), commentController.getReports);
router.put('/admin/reports/:id/resolve', authorize('admin'), commentController.resolveReport);
router.delete('/admin/:id/hard', authorize('admin'), commentController.hardDeleteComment);

module.exports = router;
