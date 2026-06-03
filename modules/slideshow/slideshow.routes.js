const express = require('express');
const router = express.Router();
const slideshowController = require('./slideshow.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

// Public route - không cần auth
router.get('/active', slideshowController.getActiveSlides);

// Admin routes
router.get('/', authenticate, requireAdmin, slideshowController.getAllSlides);
router.post('/', authenticate, requireAdmin, slideshowController.createSlide);
router.put('/:id', authenticate, requireAdmin, slideshowController.updateSlide);
router.delete('/:id', authenticate, requireAdmin, slideshowController.deleteSlide);

module.exports = router;