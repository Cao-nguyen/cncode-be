// modules/statistic/statistic.routes.js
const express = require('express');
const router = express.Router();
const statisticController = require('./statistic.controller');

router.get('/public/stats', statisticController.getPublicStats);
router.get('/online-stats', statisticController.getOnlineStats);

module.exports = router;