// modules/khuvuon/khuvuon.routes.js
const express = require('express');
const router = express.Router();
const controller = require('./khuvuon.controller');
const { authenticate } = require('../../middleware/auth.middleware'); // Đường dẫn tới file middleware bạn vừa gửi

// Áp dụng authenticate vào các route cần quyền user
router.get('/status', authenticate, controller.getGarden);
router.get('/question', authenticate, controller.getQuestion);
router.post('/answer', authenticate, controller.submitAnswer);
router.post('/water', authenticate, controller.waterTree);

// Route admin
router.post('/admin/questions', authenticate, controller.addQuestion);

module.exports = router;