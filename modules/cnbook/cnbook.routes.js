// modules/cnbook/cnbook.routes.js
const express = require('express');
const router = express.Router();
const controller = require('./cnbook.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// ============ PUBLIC ROUTES ============
router.get('/', controller.getBooks);
router.get('/:slug', controller.getBookBySlug);  // 👈 Route này bắt tất cả các string

// ============ PROTECTED ROUTES ============
router.use(authenticate);

// User learning
router.post('/purchase', controller.purchaseBook);
router.get('/learn/:bookId', controller.getUserBook);
router.post('/note', controller.saveNote);
router.post('/exercise-answer', controller.saveExerciseAnswer);
router.post('/progress', controller.updateProgress);
router.get('/progress/:bookId', controller.getUserProgress);

// User books management (author)
router.get('/user/books', controller.getUserBooks);  // 👈 ĐỔI TÊN để tránh conflict
router.post('/', controller.createBook);
router.get('/detail/:id', controller.getBookById);   // 👈 THÊM ROUTE MỚI cho get by id
router.put('/:id', controller.updateBook);
router.delete('/:id', controller.deleteBook);

// Sections
router.post('/:bookId/sections', controller.addSection);
router.put('/:bookId/sections/:sectionId', controller.updateSection);
router.delete('/:bookId/sections/:sectionId', controller.deleteSection);

// Lessons
router.post('/:bookId/sections/:sectionId/lessons', controller.addLesson);
router.put('/lessons/:id', controller.updateLesson);
router.delete('/lessons/:id', controller.deleteLesson);

// Exercises
router.post('/lessons/:lessonId/exercises', controller.addExercise);
router.put('/exercises/:id', controller.updateExercise);
router.delete('/exercises/:id', controller.deleteExercise);

// ============ ADMIN ROUTES ============
router.get('/admin/list', authorize('admin'), controller.getAdminBooks);
router.get('/admin/statistics', authorize('admin'), controller.getStatistics);
router.put('/admin/:id/approve', authorize('admin'), controller.approveBook);
router.delete('/admin/:id', authorize('admin'), controller.deleteBook);

module.exports = router;