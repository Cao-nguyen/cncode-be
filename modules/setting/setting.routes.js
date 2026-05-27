
const express = require('express');
const router = express.Router();
const settingController = require('./setting.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', settingController.getSettings);
router.get('/:key', settingController.getSettingByKey);
router.put('/:key', settingController.updateSetting);

module.exports = router;
