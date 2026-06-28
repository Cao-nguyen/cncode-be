const express = require('express');
const router = express.Router();
const progressController = require('./tiendo.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// All progress routes require authentication
router.post('/lesson/:lessonId', authenticate, progressController.upsertProgress);
router.get('/lesson/:lessonId', authenticate, progressController.getProgress);
router.get('/course/:courseId', authenticate, progressController.getCourseProgress);

module.exports = router;