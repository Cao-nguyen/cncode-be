const router = require('express').Router();
const controller = require('./helpcenter.controller.admin');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/all', authenticate, authorize('admin'), controller.getAllFAQs);
router.get('/stats', authenticate, authorize('admin'), controller.getStats);
router.post('/', authenticate, authorize('admin'), controller.createFAQ);
router.put('/:id', authenticate, authorize('admin'), controller.updateFAQ);
router.delete('/:id', authenticate, authorize('admin'), controller.deleteFAQ);
router.put('/order', authenticate, authorize('admin'), controller.updateOrder);

module.exports = router;
