const express = require('express');
const router = express.Router();
const chapterController = require('./chuong.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/auth.middleware');

// Teacher routes
router.post('/', authenticate, authorize('teacher'), chapterController.create);
router.put('/:id', authenticate, authorize('teacher'), chapterController.update);
router.delete('/:id', authenticate, authorize('teacher'), chapterController.delete);
router.put('/course/:courseId/reorder', authenticate, authorize('teacher'), chapterController.reorder);

// Public routes (for viewing course structure)
router.get('/:id', chapterController.getById);
router.get('/course/:courseId', chapterController.getByCourseId);

module.exports = router;