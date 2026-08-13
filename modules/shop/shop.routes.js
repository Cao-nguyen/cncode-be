const express = require('express');
const router = express.Router();
const shopController = require('./shop.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

// Public routes
router.get('/products', optionalAuth, shopController.getProducts);
router.get('/products/slug/:slug', optionalAuth, shopController.getProductBySlug);

// Admin stats
router.get('/admin/stats', authenticate, shopController.getStats);

// Protected routes (user routes)
router.get('/me/products', authenticate, shopController.getMyProducts);
router.get('/products/:id/purchase-status', authenticate, shopController.getPurchaseStatus);
router.post('/products/:id/purchase/payos', authenticate, shopController.purchaseProductWithPayos);
router.post('/products/:id/purchase', authenticate, shopController.purchaseProduct);
router.post('/products/:id/downloads', authenticate, shopController.recordProductDownload);
router.get('/products/:id/reviews', shopController.getProductReviews);
router.get('/products/:id/reviews/me', optionalAuth, shopController.getMyProductReview);
router.post('/products/:id/reviews', authenticate, shopController.createProductReview);
router.put('/products/:id/reviews/:reviewId', authenticate, shopController.updateProductReview);
router.delete('/products/:id/reviews/:reviewId', authenticate, shopController.deleteProductReview);
router.post('/products', authenticate, shopController.createProduct);
router.put('/products/:id', authenticate, shopController.updateProduct);
router.delete('/products/:id', authenticate, shopController.deleteProduct);

// Admin moderation
router.post('/products/:id/approve', authenticate, shopController.approveProduct);
router.post('/products/:id/reject', authenticate, shopController.rejectProduct);

// Single product by id (after specific routes)
router.get('/products/:id', optionalAuth, shopController.getProduct);

module.exports = router;
