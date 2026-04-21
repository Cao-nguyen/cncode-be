// modules/dashboard/dashboard.routes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Route cho user thường
router.get('/user', authenticate, dashboardController.getUserDashboard);

// Route cho admin (chỉ admin mới truy cập được)
router.get('/admin', authenticate, authorize('admin'), dashboardController.getAdminDashboard);

module.exports = router;