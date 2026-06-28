const express = require('express');
const router = express.Router();
const enrollmentController = require('./enrollment.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// User routes (authenticated)
router.post('/', authenticate, enrollmentController.create);
router.get('/me', authenticate, enrollmentController.getByUserId);
router.get('/course/:courseId', authenticate, enrollmentController.getByUserAndCourse);
router.get('/:id', authenticate, enrollmentController.getById);
router.put('/:id/payment-status', authenticate, enrollmentController.updatePaymentStatus);
router.delete('/:id', authenticate, enrollmentController.delete);

module.exports = router;