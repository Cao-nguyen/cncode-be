const express = require('express');
const router = express.Router();
const exerciseController = require('./baitap.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/auth.middleware');

// Teacher routes
router.post('/', authenticate, authorize('teacher'), exerciseController.create);
router.put('/:id', authenticate, authorize('teacher'), exerciseController.update);
router.delete('/:id', authenticate, authorize('teacher'), exerciseController.delete);

// Student routes (auth + enrolled)
router.get('/:id', authenticate, exerciseController.getById);
router.get('/lesson/:lessonId', authenticate, exerciseController.getByLessonId);
router.post('/:id/submit', authenticate, exerciseController.submit);

module.exports = router;