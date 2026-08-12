const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const {
    getActiveGifts,
    sendGift,
    getReceivedGifts,
    getSentGifts,
    getGiftsForTarget,
    convertGifts,
} = require('./gift.controller.user');

router.get('/active', getActiveGifts);
router.get('/target/:targetType/:targetId', getGiftsForTarget);
router.post('/send', authenticate, sendGift);
router.get('/received', authenticate, getReceivedGifts);
router.get('/sent', authenticate, getSentGifts);
router.post('/convert/:giftId', authenticate, convertGifts);

module.exports = router;
