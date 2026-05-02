// modules/affiliate/affiliate.routes.js
const express = require('express');
const router = express.Router();
const affiliateController = require('./affiliate.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/leaderboard', affiliateController.getLeaderboard);
router.get('/track', affiliateController.trackReferral);
router.get('/my-affiliate', authenticate, affiliateController.getMyAffiliate);
router.get('/admin/stats', authenticate, authorize('admin'), affiliateController.getAllAffiliateStats);

module.exports = router;