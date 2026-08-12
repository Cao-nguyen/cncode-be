const router = require('express').Router();
const controller = require('./systemSettings.controller.admin');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/settings', authenticate, authorize('admin'), controller.getSettings);
router.get('/settings/history', authenticate, authorize('admin'), controller.getHistory);
router.put('/settings/:field', authenticate, authorize('admin'), controller.updateSetting);

module.exports = router;
