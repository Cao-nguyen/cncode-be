// modules/faq/faq.routes.js
const router = require('express').Router();
const controller = require('./faq.controller');
const { authenticate, optionalAuth, authorize } = require('../../middleware/auth.middleware');

// ========== PUBLIC ROUTES ==========
router.get('/', optionalAuth, controller.getQuestions);
router.get('/statistics', controller.getStatistics);
router.get('/:slug', optionalAuth, controller.getQuestionBySlug);

// ========== PROTECTED ROUTES ==========
router.use(authenticate);

// Question routes
router.post('/questions', controller.createQuestion);
router.post('/questions/:id/like', controller.toggleLikeQuestion);
router.delete('/questions/:id', controller.deleteQuestion);
router.put('/questions/:id', controller.updateQuestion);

// Answer routes
router.post('/answers', controller.createAnswer);
router.post('/answers/best', controller.markBestAnswer);
router.post('/answers/:id/like', controller.toggleLikeAnswer);
router.delete('/answers/:id', controller.deleteAnswer);
router.put('/answers/:id', controller.updateAnswer);

router.post('/report', controller.report);

// Admin routes
router.put('/admin/questions/:id/pin', authorize('admin'), controller.togglePinQuestion);
router.put('/admin/questions/:id/lock', authorize('admin'), controller.toggleLockQuestion);
router.delete('/admin/questions/:id', authorize('admin'), controller.deleteQuestion);

module.exports = router;