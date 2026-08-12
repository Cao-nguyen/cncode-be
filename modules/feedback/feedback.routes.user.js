const router = require('express').Router();
const controller = require('./feedback.controller.user');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

router.get('/', optionalAuth, controller.getFeedbacks);
router.get('/my', authenticate, controller.getUserFeedbacks);
router.get('/versions', controller.getVersions);
router.get('/:id', optionalAuth, controller.getFeedbackById);

router.use(authenticate);

router.post('/', controller.createFeedback);
router.post('/:id/react', controller.reactFeedback);
router.put('/:id', controller.updateFeedback);
router.delete('/:id', controller.deleteFeedback);

module.exports = router;
