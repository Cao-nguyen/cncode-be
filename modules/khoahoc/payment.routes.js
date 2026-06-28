const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// PayOS webhook (no auth – PayOS calls this endpoint)
router.post('/webhook/payos', paymentController.payosWebhook);

// All user payment endpoints require authentication
router.use(authenticate);

// PayOS payment creation
router.post('/khoahoc/:courseId/payos', paymentController.payosPayment);

// Coin payment
router.post('/khoahoc/:courseId/coin', paymentController.coinPayment);

// Check payment status for a course
router.get('/khoahoc/:courseId/status', paymentController.paymentStatus);

// Confirm PayOS payment (called from success page)
router.post('/payos/confirm', paymentController.confirmPayOSPayment);

// Free enrollment
router.post('/khoahoc/:courseId/free', paymentController.freeEnroll);

module.exports = router;
