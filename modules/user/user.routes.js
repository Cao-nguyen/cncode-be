
const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('./user.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/loveuser', userController.getLoveUser);
router.get('/profile', authenticate, userController.getProfile);
router.get('/profile/:username', userController.getProfileByUsername);
router.put('/profile', authenticate, userController.updateProfile);
router.put('/:id', authenticate, upload.single('avatar'), userController.updateProfileById);
router.post('/request-role', authenticate, userController.requestRoleChange);
router.post('/change-password', authenticate, userController.changePassword);
router.post('/upload-avatar', authenticate, userController.uploadAvatar);
router.delete('/delete-account', authenticate, userController.deleteOwnAccount);
router.get('/search', authenticate, userController.searchUsers);
router.post('/:targetUserId/follow', authenticate, userController.followUser);
router.get('/:userId/followers', userController.getFollowers);
router.get('/:userId/following', userController.getFollowing);
router.post('/increment-streak', authenticate, userController.incrementStreak);

router.get('/admin/users/stats', authenticate, authorize('admin'), userController.getUserStats);
router.get('/admin/users/stats/province', authenticate, authorize('admin'), userController.getUserStatsByProvince);
router.get('/admin/users/pending-teachers', authenticate, authorize('admin'), userController.getPendingTeachers);
router.get('/admin/users/violations/list', authenticate, authorize('admin'), userController.getViolatedUsers);
router.get('/admin/users', authenticate, authorize('admin'), userController.getAllUsers);
router.get('/admin/users/export', authenticate, authorize('admin'), userController.exportUsersToExcel);

router.get('/admin/users/:id', authenticate, authorize('admin'), userController.getUserById);
router.put('/admin/users/:id', authenticate, authorize('admin'), userController.updateUserByAdmin);
router.delete('/admin/users/:id', authenticate, authorize('admin'), userController.deleteUser);
router.post('/admin/users/:id/coins', authenticate, authorize('admin'), userController.adjustUserCoins);
router.post('/admin/users/:id/approve-teacher', authenticate, authorize('admin'), userController.approveTeacherRequest);
router.put('/admin/users/:id/role', authenticate, authorize('admin'), userController.changeUserRole);
router.post('/admin/users/:id/violations', authenticate, authorize('admin'), userController.markViolation);
router.delete('/admin/users/:id/violations/:violationId', authenticate, authorize('admin'), userController.removeViolation);

module.exports = router;
