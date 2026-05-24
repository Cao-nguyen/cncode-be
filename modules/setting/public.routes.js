// modules/setting/public.routes.js
const express = require('express');
const router = express.Router();
const publicSettingController = require('./public.controller');

router.get('/:key', publicSettingController.getSettingByKey);
router.get('/', publicSettingController.getMultipleSettings);

module.exports = router;