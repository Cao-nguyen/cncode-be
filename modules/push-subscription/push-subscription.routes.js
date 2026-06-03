const express = require('express');
const router = express.Router();
const pushSubscriptionController = require('./push-subscription.controller');
const authMiddleware = require('../../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// Get VAPID public key
router.get('/vapid-public-key', pushSubscriptionController.getPublicKey);

// Subscribe to push notifications
router.post('/subscribe', pushSubscriptionController.subscribe);

// Unsubscribe from push notifications
router.post('/unsubscribe', pushSubscriptionController.unsubscribe);

// Test send notification
router.post('/test', pushSubscriptionController.testSend);

module.exports = router;