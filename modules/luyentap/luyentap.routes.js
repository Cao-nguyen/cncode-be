const express = require('express');
const router = express.Router();
const luyenTapController = require('./luyentap.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/auth.middleware');

// ===== ADMIN (auth + admin) - Must come first to avoid conflicts with /:id =====
router.get('/admin/list', authenticate, authorize('admin'), luyenTapController.getAdminList);
router.get('/admin/:id', authenticate, authorize('admin'), luyenTapController.getById);
router.post('/admin', authenticate, authorize('admin'), luyenTapController.create);
router.put('/admin/:id', authenticate, authorize('admin'), luyenTapController.update);
router.put('/admin/:id/approve', authenticate, authorize('admin'), luyenTapController.approve);
router.put('/admin/:id/reject', authenticate, authorize('admin'), luyenTapController.reject);
router.delete('/admin/:id', authenticate, authorize('admin'), luyenTapController.delete);

// ===== PUBLIC =====
router.get('/public', luyenTapController.getPublicList);
router.get('/public/leaderboard/overall', luyenTapController.getOverallLeaderboard);
router.get('/public/id/:id', luyenTapController.getPublicById);
router.get('/public/:slug', luyenTapController.getBySlug);

// ===== USER (auth) - Must come before /:id routes =====
router.get('/me/exercises', authenticate, luyenTapController.getUserExercises);
router.get('/me/exercises/:id/history', authenticate, luyenTapController.getUserExerciseHistory);
router.get('/me/exercises/:id/check-attempts', authenticate, luyenTapController.checkUserAttempts);

// ===== Routes with :id - Must come last =====
router.get('/:id/leaderboard', luyenTapController.getExerciseLeaderboard);
router.get('/:id/take', authenticate, luyenTapController.getForTaking);
router.post('/:id/submit', authenticate, luyenTapController.submit);
router.get('/:id/result', authenticate, luyenTapController.getUserAnswer);

module.exports = router;