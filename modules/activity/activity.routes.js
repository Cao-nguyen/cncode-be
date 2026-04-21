// modules/activity/activity.routes.js
const express = require('express');
const router = express.Router();
const activityController = require('./activity.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Lấy danh sách hoạt động (chỉ admin mới xem được)
router.get('/', authenticate, authorize('admin'), activityController.getAllActivities);

// Lấy thống kê hoạt động (chỉ admin)
router.get('/stats', authenticate, authorize('admin'), activityController.getActivityStats);

module.exports = router;