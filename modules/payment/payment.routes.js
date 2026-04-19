const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.post('/xu', authenticate, paymentController.purchaseWithXu);
router.post('/payos', authenticate, paymentController.purchaseWithPayOS);
router.post('/webhook', authenticate, express.raw({ type: 'application/json' }), paymentController.handleWebhook);
router.get('/success', authenticate, paymentController.paymentSuccess);
router.get('/cancel', authenticate, paymentController.paymentCancel);
router.get('/status/:orderCode', authenticate, paymentController.checkPaymentStatus);

module.exports = router;