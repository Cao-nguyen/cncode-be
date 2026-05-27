
const express = require('express');
const router = express.Router();
const helpCenterController = require('./helpcenter.controller');
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth.middleware');

router.get('/', optionalAuth, helpCenterController.getFAQs);
router.get('/:id', authenticate, helpCenterController.getFAQById);
router.post('/:id/helpful', authenticate, helpCenterController.toggleHelpful);

router.get('/admin/all', authenticate, authorize('admin'), helpCenterController.getAllFAQs);
router.get('/admin/stats', authenticate, authorize('admin'), helpCenterController.getStats);
router.post('/admin', authenticate, authorize('admin'), helpCenterController.createFAQ);
router.put('/admin/:id', authenticate, authorize('admin'), helpCenterController.updateFAQ);
router.delete('/admin/:id', authenticate, authorize('admin'), helpCenterController.deleteFAQ);
router.put('/admin/order', authenticate, authorize('admin'), helpCenterController.updateOrder);

module.exports = router;
