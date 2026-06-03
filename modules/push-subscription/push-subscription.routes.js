const express = require('express');
const router = express.Router();
const pushSubscriptionController = require('./push-subscription.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Get VAPID public key (public route)
router.get('/vapid-public-key', pushSubscriptionController.getPublicKey);

// Subscribe to push notifications (requires auth)
router.post('/subscribe', authenticate, pushSubscriptionController.subscribe);

// Unsubscribe from push notifications (requires auth)
router.post('/unsubscribe', authenticate, pushSubscriptionController.unsubscribe);

// Test send notification (requires auth)
router.post('/test', authenticate, pushSubscriptionController.testSend);

module.exports = router;