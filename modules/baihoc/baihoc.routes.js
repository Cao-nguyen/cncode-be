const express = require('express');
const router = express.Router();
const lessonController = require('./baihoc.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/auth.middleware');

// Teacher routes
router.post('/', authenticate, authorize('teacher'), lessonController.create);
router.put('/:id', authenticate, authorize('teacher'), lessonController.update);
router.delete('/:id', authenticate, authorize('teacher'), lessonController.delete);
router.put('/chapter/:chapterId/reorder', authenticate, authorize('teacher'), lessonController.reorder);

// Public/enrolled routes
router.get('/:id', lessonController.getById);
router.get('/chapter/:chapterId', lessonController.getByChapterId);

module.exports = router;