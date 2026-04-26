const express = require('express');
const shortlinkController = require('./shortlink.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

const router = express.Router();

router.get('/s/:shortCode', shortlinkController.redirectToOriginal);
router.get('/check-alias/:alias', shortlinkController.checkAlias);
router.post('/shorten', authenticate, shortlinkController.createShortLink);
router.get('/my-links', authenticate, shortlinkController.getUserLinks);
router.get('/admin/all', authenticate, authorize('admin', 'leader'), shortlinkController.getAllLinks);
router.put('/:shortCode', authenticate, shortlinkController.updateShortLink);
router.delete('/:shortCode', authenticate, shortlinkController.deleteShortLink);

module.exports = router;


// ─── redirectRouter (export riêng để mount ở root /s/:shortCode) ───────────
const redirectRouter = express.Router();
redirectRouter.get('/s/:shortCode', shortlinkController.redirectToOriginal);
module.exports.redirectRouter = redirectRouter;