// modules/user/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// ============= USER ROUTES =============
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.post('/request-role', authenticate, userController.requestRoleChange);
router.post('/change-password', authenticate, userController.changePassword);
router.post('/upload-avatar', authenticate, userController.uploadAvatar);
router.delete('/delete-account', authenticate, userController.deleteOwnAccount);

// ============= ADMIN ROUTES =============
// Đặt các route tĩnh (không có tham số) TRƯỚC route có tham số
router.get('/admin/users/stats', authenticate, authorize('admin'), userController.getUserStats);
router.get('/admin/users/stats/province', authenticate, authorize('admin'), userController.getUserStatsByProvince);
router.get('/admin/users/pending-teachers', authenticate, authorize('admin'), userController.getPendingTeachers);
router.get('/admin/users/violations/list', authenticate, authorize('admin'), userController.getViolatedUsers);
router.get('/admin/users', authenticate, authorize('admin'), userController.getAllUsers);

// Route có tham số (đặt sau)
router.get('/admin/users/:id', authenticate, authorize('admin'), userController.getUserById);
router.put('/admin/users/:id', authenticate, authorize('admin'), userController.updateUserByAdmin);
router.delete('/admin/users/:id', authenticate, authorize('admin'), userController.deleteUser);
router.post('/admin/users/:id/coins', authenticate, authorize('admin'), userController.adjustUserCoins);
router.post('/admin/users/:id/approve-teacher', authenticate, authorize('admin'), userController.approveTeacherRequest);
router.put('/admin/users/:id/role', authenticate, authorize('admin'), userController.changeUserRole);
router.post('/admin/users/:id/violations', authenticate, authorize('admin'), userController.markViolation);
router.delete('/admin/users/:id/violations/:violationId', authenticate, authorize('admin'), userController.removeViolation);

module.exports = router;