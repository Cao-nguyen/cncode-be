// modules/user/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Đảm bảo route này tồn tại
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.post('/request-role', authenticate, userController.requestRoleChange);

module.exports = router;