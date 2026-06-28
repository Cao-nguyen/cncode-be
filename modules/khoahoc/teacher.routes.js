const express = require('express');
const router = express.Router();
const courseController = require('./khoahoc.controller');
const chapterController = require('../chuong/chuong.controller');
const lessonController = require('../baihoc/baihoc.controller');
const exerciseController = require('../baitap/baitap.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// All routes require authentication (and typically role=teacher, handled by logic or further middleware)

// ===== KHOA HOC =====
router.get('/khoahoc', authenticate, courseController.getTeacherCourses);
router.post('/khoahoc', authenticate, courseController.create);
router.put('/khoahoc/:id', authenticate, courseController.update);
router.put('/khoahoc/:id/submit', authenticate, courseController.submitForReview);
router.put('/khoahoc/:id/toggle-hide', authenticate, courseController.toggleHide);
router.delete('/khoahoc/:id', authenticate, courseController.delete);

// ===== CHAPTERS =====
router.get('/khoahoc/:courseId/chapters', authenticate, chapterController.getByCourseId);
router.get('/khoahoc/:courseId/content', authenticate, chapterController.getByCourseId);
router.post('/khoahoc/:courseId/chapters', authenticate, chapterController.create);
router.put('/khoahoc/:courseId/chapters/reorder', authenticate, chapterController.reorder);
router.put('/chapters/:chapterId', authenticate, chapterController.update);
router.delete('/chapters/:chapterId', authenticate, chapterController.delete);

// ===== LESSONS =====
router.post('/chapters/:chapterId/lessons', authenticate, lessonController.create);
router.put('/chapters/:chapterId/lessons/reorder', authenticate, lessonController.reorder);
router.put('/lessons/:lessonId', authenticate, lessonController.update);
router.delete('/lessons/:lessonId', authenticate, lessonController.delete);

// ===== EXERCISES =====
router.post('/lessons/:lessonId/exercise', authenticate, exerciseController.create);
router.put('/exercises/:exerciseId', authenticate, exerciseController.update);

module.exports = router;