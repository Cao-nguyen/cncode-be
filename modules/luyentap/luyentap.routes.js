const express = require('express');
const router = express.Router();
const luyenTapController = require('./luyentap.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/auth.middleware');

// ===== ADMIN (auth + admin) - Must come first to avoid conflicts with /:id =====
router.get('/admin/folders', authenticate, authorize('admin'), luyenTapController.listFolders);
router.post('/admin/folders', authenticate, authorize('admin'), luyenTapController.createFolder);
router.put('/admin/folders/:folderId', authenticate, authorize('admin'), luyenTapController.updateFolder);
router.delete('/admin/folders/:folderId', authenticate, authorize('admin'), luyenTapController.deleteFolder);
router.get('/admin/list', authenticate, authorize('admin'), luyenTapController.getAdminList);
router.get('/admin/:id/overview', authenticate, authorize('admin'), luyenTapController.getAdminOverview);
router.get('/admin/:id/detailed-statistics', authenticate, authorize('admin'), luyenTapController.getAdminDetailedStatistics);
router.get('/admin/:id/submissions', authenticate, authorize('admin'), luyenTapController.getAdminSubmissions);
router.get('/admin/:id/submissions/:answerId', authenticate, authorize('admin'), luyenTapController.getAdminSubmissionDetail);
router.put('/admin/:id/submissions/:answerId/grade-essays', authenticate, authorize('admin'), luyenTapController.gradeEssayAnswers);
router.get('/admin/:id', authenticate, authorize('admin'), luyenTapController.getById);
router.post('/admin', authenticate, authorize('admin'), luyenTapController.create);
router.put('/admin/:id', authenticate, authorize('admin'), luyenTapController.update);
router.put('/admin/:id/approve', authenticate, authorize('admin'), luyenTapController.approve);
router.put('/admin/:id/reject', authenticate, authorize('admin'), luyenTapController.reject);
router.delete('/admin/:id', authenticate, authorize('admin'), luyenTapController.delete);
router.post('/admin/scan-explanations', authenticate, authorize('admin'), luyenTapController.scanExplanations);
router.post('/run-code', authenticate, luyenTapController.runCode);

// ===== PUBLIC =====
router.get('/public', luyenTapController.getPublicList);
router.get('/public/leaderboard/overall', luyenTapController.getOverallLeaderboard);
router.get('/public/id/:id', luyenTapController.getPublicById);
router.get('/public/:slug', luyenTapController.getBySlug);

// ===== USER (auth) - Must come before /:id routes =====
router.get('/me/purchases', authenticate, luyenTapController.getUserPurchases);
router.get('/me/exercises', authenticate, luyenTapController.getUserExercises);
router.get('/me/exercises/:id/purchase-status', authenticate, luyenTapController.getPurchaseStatus);
router.post('/me/exercises/:id/purchase/coin', authenticate, luyenTapController.purchaseWithCoin);
router.post('/me/exercises/:id/purchase/payos', authenticate, luyenTapController.purchaseWithPayos);
router.get('/me/exercises/:id/history', authenticate, luyenTapController.getUserExerciseHistory);
router.get('/me/exercises/:id/check-attempts', authenticate, luyenTapController.checkUserAttempts);
router.get('/me/exercises/:id/access', authenticate, luyenTapController.getExerciseAccess);
router.post('/me/exercises/:id/verify-password', authenticate, luyenTapController.verifyExercisePassword);

// ===== Routes with :id - Must come last =====
router.get('/:id/reactions', optionalAuth, luyenTapController.getExerciseReactions);
router.get('/:id/statistics', optionalAuth, luyenTapController.getExerciseStatistics);
router.get('/:id/participants', luyenTapController.getRecentParticipants);
router.post('/:id/react', authenticate, luyenTapController.reactToExercise);
router.get('/:id/leaderboard', luyenTapController.getExerciseLeaderboard);
router.get('/:id/take', authenticate, luyenTapController.getForTaking);
router.post('/:id/attempt', authenticate, luyenTapController.startAttempt);
router.put('/:id/attempt/:attemptId', authenticate, luyenTapController.saveAttempt);
router.post('/:id/submit', authenticate, luyenTapController.submit);
router.post('/:id/spin-coin', authenticate, luyenTapController.spinExerciseCoin);
router.get('/:id/result', authenticate, luyenTapController.getUserAnswer);

module.exports = router;