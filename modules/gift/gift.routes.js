const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const {
  getAllGifts,
  createGift,
  updateGift,
  deleteGift,
  getActiveGifts,
  sendGift,
  getReceivedGifts,
  getSentGifts,
  getGiftsForTarget,
  convertGifts
} = require('./gift.controller');

// Admin routes
router.get('/admin/all', authenticate, authorize('admin'), getAllGifts);
router.post('/admin', authenticate, authorize('admin'), createGift);
router.put('/admin/:id', authenticate, authorize('admin'), updateGift);
router.delete('/admin/:id', authenticate, authorize('admin'), deleteGift);

// User routes
router.get('/active', getActiveGifts);
router.post('/send', authenticate, sendGift);
router.get('/received', authenticate, getReceivedGifts);
router.get('/sent', authenticate, getSentGifts);
router.get('/target/:targetType/:targetId', getGiftsForTarget);
router.post('/convert/:giftId', authenticate, convertGifts);

module.exports = router;
