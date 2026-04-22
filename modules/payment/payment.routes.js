// modules/payment/payment.routes.js
const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.post('/webhook', express.json(), paymentController.handleWebhook);

router.post('/xu', authenticate, paymentController.purchaseWithXu);
router.post('/payos', authenticate, paymentController.purchaseWithPayOS);
router.get('/status/:orderCode', authenticate, paymentController.checkPaymentStatus);
router.get('/check/:productId', authenticate, paymentController.checkPurchased);

// Admin routes
router.get('/admin/transactions', authenticate, authorize('admin'), paymentController.getAllTransactions);
router.get('/admin/transactions/:id', authenticate, authorize('admin'), paymentController.getTransactionById);
router.put('/admin/transactions/:id/status', authenticate, authorize('admin'), paymentController.updateTransactionStatus);

module.exports = router;