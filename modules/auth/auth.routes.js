const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Đảm bảo không có dòng nào bị trùng
router.post('/google', authController.googleLogin);
router.get('/check-username', authController.checkUsername);
router.post('/onboarding', authenticate, authController.onboarding);
router.get('/me', authenticate, authController.getMe);
router.post('/streak', authenticate, authController.updateStreak);  // 👈 Chỉ 1 lần

module.exports = router;