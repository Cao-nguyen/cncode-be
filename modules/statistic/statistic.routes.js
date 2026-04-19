const express = require('express');
const router = express.Router();
const statisticController = require('./statistic.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/public/stats', statisticController.getPublicStats);

module.exports = router;