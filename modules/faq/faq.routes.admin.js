const router = require('express').Router();
const controller = require('./faq.controller.admin');
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth.middleware');

router.get('/', optionalAuth, controller.getQuestions);
router.get('/statistics', authenticate, authorize('admin'), controller.getStatistics);
router.get('/:slug', optionalAuth, controller.getQuestionBySlug);
router.post('/increment-view/:slug', controller.incrementViewCount);

router.use(authenticate);

router.put('/answers/:id', authorize('admin'), controller.updateAnswer);
router.put('/questions/:id/pin', authorize('admin'), controller.togglePinQuestion);
router.put('/questions/:id/lock', authorize('admin'), controller.toggleLockQuestion);
router.delete('/questions/:id', authorize('admin'), controller.deleteQuestion);
router.delete('/answers/:id', authorize('admin'), controller.deleteAnswer);

module.exports = router;
