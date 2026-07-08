const express = require('express');
const router = express.Router();
const dautruongController = require('./dautruong.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/auth.middleware');

// ===== ADMIN (auth + admin) - Must come first to avoid conflicts with /:id =====
router.get('/admin/list', authenticate, authorize('admin'), dautruongController.getAdminList);
router.get('/admin/:id', authenticate, authorize('admin'), dautruongController.getById);
router.post('/admin', authenticate, authorize('admin'), dautruongController.create);
router.put('/admin/:id', authenticate, authorize('admin'), dautruongController.update);
router.delete('/admin/:id', authenticate, authorize('admin'), dautruongController.delete);

// ===== PUBLIC =====
router.get('/public', dautruongController.getPublicList);
router.get('/public/leaderboard/overall', dautruongController.getOverallLeaderboard);
router.get('/public/id/:id', dautruongController.getPublicById);
router.get('/public/:slug', dautruongController.getBySlug);

// ===== USER (auth) - Must come before /:id routes =====
router.get('/me/contests', authenticate, dautruongController.getUserContests);
router.get('/me/contests/:id/history', authenticate, dautruongController.getUserContestHistory);
router.get('/me/contests/:id/check-attempts', authenticate, dautruongController.checkUserAttempts);

// ===== Routes with :id - Must come last =====
router.get('/:id/leaderboard', dautruongController.getContestLeaderboard);
router.get('/:id/take', authenticate, dautruongController.getForTaking);
router.post('/:id/submit', authenticate, dautruongController.submit);
router.get('/:id/result', authenticate, dautruongController.getUserAnswer);

module.exports = router;
