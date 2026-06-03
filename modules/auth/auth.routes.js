const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { strictLimiter } = require('../../middleware/ratelimit.middleware');
const { criticalQueueMiddleware } = require('../../middleware/queue.middleware');

// Apply strict rate limiting and critical queue for auth routes
router.use(strictLimiter);
router.use(criticalQueueMiddleware);

router.post('/google', authController.googleLogin);
router.get('/check-username', authController.checkUsername);
router.post('/onboarding', authenticate, authController.onboarding);
router.get('/me', authenticate, authController.getMe);
router.post('/streak', authenticate, authController.updateStreak);

module.exports = router;
