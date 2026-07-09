const express = require('express');
const router = express.Router();
const exerciseController = require('./baitap.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/auth.middleware');

// Admin & Teacher routes (must be before /:id to avoid conflicts)
router.post('/lesson/:lessonId', authenticate, authorize('admin', 'teacher'), exerciseController.createByLessonId);
router.post('/', authenticate, authorize('admin', 'teacher'), exerciseController.create);
router.put('/:id', authenticate, authorize('admin', 'teacher'), exerciseController.update);
router.delete('/:id', authenticate, authorize('admin', 'teacher'), exerciseController.delete);

// Student routes (auth + enrolled)
router.get('/lesson/:lessonId', authenticate, exerciseController.getByLessonId);
router.get('/:id', authenticate, exerciseController.getById);
router.post('/:id/submit', authenticate, exerciseController.submit);

module.exports = router;