
const express = require('express');
const router = express.Router();
const controller = require('./cnbook.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', controller.getBooks);
router.get('/:slug', controller.getBookBySlug);  

router.use(authenticate);

router.post('/purchase', controller.purchaseBook);
router.get('/learn/:bookId', controller.getUserBook);
router.post('/note', controller.saveNote);
router.post('/exercise-answer', controller.saveExerciseAnswer);
router.post('/progress', controller.updateProgress);
router.get('/progress/:bookId', controller.getUserProgress);

router.get('/user/books', controller.getUserBooks);  
router.post('/', controller.createBook);
router.get('/detail/:id', controller.getBookById);   
router.put('/:id', controller.updateBook);
router.delete('/:id', controller.deleteBook);

router.post('/:bookId/sections', controller.addSection);
router.put('/:bookId/sections/:sectionId', controller.updateSection);
router.delete('/:bookId/sections/:sectionId', controller.deleteSection);

router.post('/:bookId/sections/:sectionId/lessons', controller.addLesson);
router.put('/lessons/:id', controller.updateLesson);
router.delete('/lessons/:id', controller.deleteLesson);

router.post('/lessons/:lessonId/exercises', controller.addExercise);
router.put('/exercises/:id', controller.updateExercise);
router.delete('/exercises/:id', controller.deleteExercise);

router.get('/admin/list', authorize('admin'), controller.getAdminBooks);
router.get('/admin/statistics', authorize('admin'), controller.getStatistics);
router.put('/admin/:id/approve', authorize('admin'), controller.approveBook);
router.delete('/admin/:id', authorize('admin'), controller.deleteBook);

module.exports = router;
