// modules/system-settings/system-settings.routes.js
const express = require('express');
const router = express.Router();
const systemSettingsController = require('./system-settings.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Public routes (cho user xem)
router.get('/public/:slug', systemSettingsController.getPublicContent);

// Admin routes
router.get('/admin/settings', authenticate, authorize('admin'), systemSettingsController.getSettings);
router.get('/admin/settings/history', authenticate, authorize('admin'), systemSettingsController.getHistory);

// Cập nhật từng trang
router.put('/admin/settings/chinh-sach-bao-hanh', authenticate, authorize('admin'), systemSettingsController.updateChinhSachBaoHanh);
router.put('/admin/settings/huong-dan-thanh-toan', authenticate, authorize('admin'), systemSettingsController.updateHuongDanThanhToan);
router.put('/admin/settings/quy-trinh-su-dung', authenticate, authorize('admin'), systemSettingsController.updateQuyTrinhSuDung);
router.put('/admin/settings/gioi-thieu', authenticate, authorize('admin'), systemSettingsController.updateGioiThieu);
router.put('/admin/settings/an-toan-bao-mat', authenticate, authorize('admin'), systemSettingsController.updateAnToanBaoMat);
router.put('/admin/settings/dieu-khoan-su-dung', authenticate, authorize('admin'), systemSettingsController.updateDieuKhoanSuDung);

module.exports = router;