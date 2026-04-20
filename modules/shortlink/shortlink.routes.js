const express = require('express');
const router = express.Router();
const shortlinkController = require('./shortlink.controller');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

router.post('/create', optionalAuth, shortlinkController.createShortLink);
router.get('/lk/:slug', shortlinkController.redirectToOriginal);
router.get('/user/links', authenticate, shortlinkController.getUserLinks);
router.delete('/:slug', authenticate, shortlinkController.deleteLink);

module.exports = router;