const router = require('express').Router();
const controller = require('./feedback.controller.admin');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/all', authenticate, authorize('admin'), controller.getAllFeedbacks);
router.get('/stats', authenticate, authorize('admin'), controller.getStats);
router.get('/:id', authenticate, authorize('admin'), controller.getFeedbackById);
router.put('/:id/status', authenticate, authorize('admin'), controller.updateFeedbackStatus);
router.post('/:id/pin', authenticate, authorize('admin'), controller.togglePinFeedback);
router.post('/:id/lock', authenticate, authorize('admin'), controller.toggleLockFeedback);
router.delete('/:id', authenticate, authorize('admin'), controller.deleteFeedback);

module.exports = router;
