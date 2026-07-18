const router = require('express').Router();
const controller = require('./shortlink.controller.admin');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/all', authenticate, authorize('admin'), controller.getAllLinks);
router.get('/stats', authenticate, authorize('admin'), controller.getStats);
router.get('/:shortCode/stats', authenticate, authorize('admin'), controller.getLinkClickStats);
router.delete('/:shortCode', authenticate, authorize('admin'), controller.deleteShortLink);

module.exports = router;
