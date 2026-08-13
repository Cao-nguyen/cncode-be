const express = require('express');
const router = express.Router();
const courseController = require('./khoahoc.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/auth.middleware');

// ===== PUBLIC =====
router.get('/', courseController.getPublicList);
router.get('/course/:courseId/reviews', courseController.getCourseReviews);
router.get('/course/:courseId/reviews/me', authenticate, courseController.getMyCourseReview);
router.post('/course/:courseId/reviews', authenticate, courseController.createCourseReview);
router.put('/course/:courseId/reviews/:reviewId', authenticate, courseController.updateCourseReview);
router.delete('/course/:courseId/reviews/:reviewId', authenticate, courseController.deleteCourseReview);
router.get('/:slug', courseController.getBySlug);

// ===== LEARN (auth + enrolled) =====
router.get('/:courseId/learn', authenticate, courseController.getLearnData);

// ===== CERTIFICATE =====
const certificateController = require('../chungchi/chungchi.controller');
router.get('/:courseId/certificate/check', authenticate, certificateController.checkEligible);
router.post('/:courseId/certificate', authenticate, certificateController.create);
router.get('/:courseId/certificate', authenticate, certificateController.get);

// ===== USER: My courses =====
router.get('/me/enrolled', authenticate, courseController.getUserCourses);

module.exports = router;