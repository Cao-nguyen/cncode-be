const router = require('express').Router();
const { getAllFAQs, createFAQ, updateFAQ, deleteFAQ, updateOrder, getStats } = require('./helpcenter.controller.admin');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/all', authenticate, authorize('admin'), getAllFAQs);
router.get('/stats', authenticate, authorize('admin'), getStats);
router.post('/', authenticate, authorize('admin'), createFAQ);
router.put('/:id', authenticate, authorize('admin'), updateFAQ);
router.delete('/:id', authenticate, authorize('admin'), deleteFAQ);
router.put('/order', authenticate, authorize('admin'), updateOrder);

module.exports = router;
