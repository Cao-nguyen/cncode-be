const express = require('express');
const router = express.Router();
const courseController = require('./khoahoc.controller');
const chapterController = require('../chuong/chuong.controller');
const lessonController = require('../baihoc/baihoc.controller');
const exerciseController = require('../baitap/baitap.controller');
const uploadController = require('../upload/upload.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// All routes require authenticate & admin role 
router.use(authenticate, authorize('admin'));

// ===== COURSES ===== 
router.post('/khoahoc', courseController.create);
router.get('/khoahoc', courseController.getAdminList);
router.get('/khoahoc/stats', courseController.getStats);
router.put('/khoahoc/:id/approve', courseController.approve);
router.put('/khoahoc/:id/reject', courseController.reject);
router.put('/khoahoc/:id', courseController.adminUpdate);
router.delete('/khoahoc/:id', courseController.adminDelete);

// ===== CHAPTERS ===== 
router.get('/:courseId/chapters', chapterController.getByCourseId);
router.get('/:courseId/content', chapterController.getByCourseId);
router.post('/:courseId/chapters', chapterController.create);
router.put('/:courseId/chapters/reorder', chapterController.reorder);
router.put('/chapters/:id', chapterController.update);
router.delete('/chapters/:id', chapterController.delete);

// ===== LESSONS ===== 
router.post('/chapters/:chapterId/lessons', lessonController.create);
router.put('/chapters/:chapterId/lessons/reorder', lessonController.reorder);
router.put('/lessons/:id', lessonController.update);
router.delete('/lessons/:id', lessonController.delete);

// ===== EXERCISES ===== 
router.post('/lessons/:lessonId/exercise', exerciseController.create);
router.put('/exercises/:id', exerciseController.update);

module.exports = router;