const multer = require('multer');
const uploadService = require('../../services/upload.service');

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

const express = require('express');
const router = express.Router();
const slideshowController = require('./slideshow.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

// Public route - không cần auth
router.get('/active', slideshowController.getActiveSlides);

// Admin routes
router.get('/', authenticate, requireAdmin, slideshowController.getAllSlides);
router.post('/', authenticate, requireAdmin, upload.single('image'), slideshowController.createSlide);
router.put('/:id', authenticate, requireAdmin, upload.single('image'), slideshowController.updateSlide);
router.delete('/:id', authenticate, requireAdmin, slideshowController.deleteSlide);

module.exports = router;