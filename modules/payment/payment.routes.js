const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.post('/xu', authenticate, paymentController.purchaseWithXu);
router.post('/payos', authenticate, paymentController.purchaseWithPayOS);
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);
router.get('/success', paymentController.paymentSuccess);
router.get('/cancel', paymentController.paymentCancel);
router.get('/status/:orderCode', paymentController.checkPaymentStatus);

module.exports = router;