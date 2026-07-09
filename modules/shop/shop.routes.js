const express = require('express');
const router = express.Router();
const shopController = require('./shop.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Public routes
router.get('/products', shopController.getProducts);
router.get('/products/:id', shopController.getProduct);

// Admin routes
router.get('/admin/stats', authenticate, shopController.getStats);

// Protected routes (user routes)
router.post('/products', authenticate, shopController.createProduct);
router.put('/products/:id', authenticate, shopController.updateProduct);
router.delete('/products/:id', authenticate, shopController.deleteProduct);

// Admin only routes
router.post('/products/:id/approve', authenticate, shopController.approveProduct);
router.post('/products/:id/reject', authenticate, shopController.rejectProduct);

module.exports = router;