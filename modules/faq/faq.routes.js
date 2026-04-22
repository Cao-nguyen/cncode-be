// modules/faq/faq.routes.js
const express = require('express');
const router = express.Router();
const faqController = require('./faq.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Public routes
router.get('/', faqController.getFAQs);
router.get('/:id', faqController.getFAQById);
router.post('/:id/helpful', faqController.rateHelpful);

// Admin routes
router.get('/admin/all', authenticate, authorize('admin'), faqController.getAllFAQsAdmin);
router.post('/admin', authenticate, authorize('admin'), faqController.createFAQ);
router.put('/admin/:id', authenticate, authorize('admin'), faqController.updateFAQ);
router.delete('/admin/:id', authenticate, authorize('admin'), faqController.deleteFAQ);

module.exports = router;