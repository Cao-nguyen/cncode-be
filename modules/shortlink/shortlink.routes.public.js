const router = require('express').Router();
const controller = require('./shortlink.controller.user');

// Public routes (no /api prefix)
router.get('/s/:shortCode', controller.redirectToOriginal);
router.get('/check-alias/:alias', controller.checkAlias);

module.exports = router;
