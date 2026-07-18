const router = require('express').Router();
const controller = require('./shortlink.controller.user');
const { authenticate } = require('../../middleware/auth.middleware');
const { shortlinkLimiter } = require('../../middleware/ratelimit.middleware');

// Authenticated routes (mounted at /api in user.routes.js)
router.post('/shorten', shortlinkLimiter, authenticate, controller.createShortLink);
router.get('/my-links', authenticate, controller.getUserLinks);
router.put('/:shortCode', authenticate, controller.updateShortLink);
router.delete('/:shortCode', authenticate, controller.deleteShortLink);
router.get('/:shortCode/stats', authenticate, controller.getLinkClickStats);

module.exports = router;
