const express = require('express');
const router = express.Router();
const statisticController = require('./statistic.controller');

router.get('/public', statisticController.getPublicStats);
router.get('/online', statisticController.getOnlineStats);
router.get('/guests', statisticController.getOnlineGuests);
router.post('/track', statisticController.trackVisitEndpoint);

module.exports = router;
