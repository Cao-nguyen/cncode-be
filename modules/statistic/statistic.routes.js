const express = require('express');
const router = express.Router();
const statisticController = require('./statistic.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/public/stats', statisticController.getPublicStats);

router.get('/statistics',
    authenticate,
    authorize('admin'),
    statisticController.getStatistics
);

router.get('/online-users',
    authenticate,
    authorize('admin'),
    statisticController.getOnlineUsers
);

router.post('/statistics/reset',
    authenticate,
    authorize('admin'),
    statisticController.resetStatistics
);

module.exports = router;