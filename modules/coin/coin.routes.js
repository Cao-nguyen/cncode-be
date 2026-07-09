const express = require('express');
const router = express.Router();
const coinController = require('./coin.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// User routes (authenticated)
router.get('/me', authenticate, coinController.getUserTransactions);
router.get('/:id', authenticate, coinController.getById);

module.exports = router;
