const router = require('express').Router();
const controller = require('./faq.controller.admin');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/', authenticate, authorize('admin'), controller.getQuestions);
router.get('/statistics', authenticate, authorize('admin'), controller.getStatistics);
router.get('/:slug', authenticate, authorize('admin'), controller.getQuestionBySlug);

router.put('/answers/:id', authenticate, authorize('admin'), controller.updateAnswer);
router.put('/questions/:id/pin', authenticate, authorize('admin'), controller.togglePinQuestion);
router.put('/questions/:id/lock', authenticate, authorize('admin'), controller.toggleLockQuestion);
router.delete('/questions/:id', authenticate, authorize('admin'), controller.deleteQuestion);
router.delete('/answers/:id', authenticate, authorize('admin'), controller.deleteAnswer);

module.exports = router;
