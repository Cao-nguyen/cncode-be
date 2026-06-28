const express = require('express');
const router = express.Router();
const certificateController = require('./chungchi.controller');
const { authenticate } = require('../../middleware/auth.middleware');

router.get('/:courseId/check', authenticate, certificateController.checkEligible);
router.post('/:courseId', authenticate, certificateController.create);
router.get('/:courseId', authenticate, certificateController.get);

module.exports = router;