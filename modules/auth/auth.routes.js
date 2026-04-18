const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');

console.log('authController methods:', Object.keys(authController));

router.post('/google', authController.googleLogin);
router.get('/check-username', authController.checkUsername);
router.post('/onboarding', authenticate, authController.onboarding);
router.get('/me', authenticate, authController.getMe);
router.post('/streak', authenticate, authController.updateStreak);

module.exports = router;