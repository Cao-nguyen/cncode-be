// modules/faq/faq.routes.js
const express = require('express');
const router = express.Router();
const faqController = require('./faq.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// ========== PUBLIC ROUTES (không cần auth) ==========
// PHẢI ĐỂ TRƯỚC các route có params
router.get('/', faqController.getQuestions);
router.get('/stats', faqController.getStats);
router.get('/related', faqController.getRelatedQuestions);

// Route có params để SAU
router.get('/:id', faqController.getQuestionById);

// ========== PROTECTED ROUTES (cần auth) ==========
router.use(authenticate);

// User routes
router.post('/', faqController.createQuestion);
router.post('/:id/answers', faqController.addAnswer);
router.put('/:id/answers/:answerId/best', faqController.markBestAnswer);
router.post('/:id/answers/:answerId/like', faqController.likeAnswer);
router.post('/:id/helpful', faqController.markHelpful);
router.delete('/:id', faqController.deleteQuestion);
router.delete('/:id/answers/:answerId', faqController.deleteAnswer);
router.get('/my/questions', faqController.getUserQuestions);

module.exports = router;