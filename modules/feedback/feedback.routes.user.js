const router = require('express').Router();
const controller = require('./feedback.controller.user');
const { authenticate } = require('../../middleware/auth.middleware');

router.get('/', controller.getFeedbacks);
router.get('/:id', controller.getFeedbackById);

router.use(authenticate);

router.post('/', controller.createFeedback);
router.get('/my', controller.getUserFeedbacks);
router.post('/:id/react', controller.reactFeedback);
router.delete('/:id', controller.deleteFeedback);
router.put('/:id', controller.updateFeedback);

module.exports = router;
