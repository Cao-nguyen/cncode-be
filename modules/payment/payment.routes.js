const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.post('/webhook', express.json(), paymentController.handleWebhook);

router.post('/xu', authenticate, paymentController.purchaseWithXu);
router.post('/payos', authenticate, paymentController.purchaseWithPayOS);
router.get('/status/:orderCode', authenticate, paymentController.checkPaymentStatus);
router.get('/check/:productId', authenticate, paymentController.checkPurchased);

module.exports = router;