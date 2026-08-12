const express = require('express');
const router = express.Router();
const transactionController = require('./transaction.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/me', authenticate, transactionController.getMyHistory);
router.get('/admin', authenticate, authorize('admin'), transactionController.getAdminHistory);

module.exports = router;
