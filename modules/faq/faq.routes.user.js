const router = require('express').Router();
const controller = require('./faq.controller.user');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

router.get('/', optionalAuth, controller.getQuestions);
router.get('/statistics', controller.getStatistics);
router.get('/:slug', optionalAuth, controller.getQuestionBySlug);
router.post('/increment-view/:slug', controller.incrementViewCount);

router.use(authenticate);

router.post('/questions', controller.createQuestion);
router.post('/questions/:id/like', controller.toggleLikeQuestion);
router.delete('/questions/:id', controller.deleteQuestion);
router.put('/questions/:id', controller.updateQuestion);

router.post('/answers', controller.createAnswer);
router.post('/answers/best', controller.markBestAnswer);
router.post('/answers/:id/like', controller.toggleLikeAnswer);
router.delete('/answers/:id', controller.deleteAnswer);

router.post('/report', controller.report);

module.exports = router;
