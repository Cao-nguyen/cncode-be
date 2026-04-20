const express = require('express');
const router = express.Router();
const shortlinkController = require('./shortlink.controller');
const { optionalAuth } = require('../../middleware/auth.middleware');

router.post('/create', optionalAuth, shortlinkController.createShortLink);
router.get('/lk/:slug', shortlinkController.redirectToOriginal);

module.exports = router;