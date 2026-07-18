const router = require('express').Router();
const controller = require('./helpcenter.controller.user');
const { optionalAuth, authenticate } = require('../../middleware/auth.middleware');

router.get('/', optionalAuth, controller.getFAQs);
router.get('/:id', authenticate, controller.getFAQById);
router.post('/:id/helpful', authenticate, controller.toggleHelpful);

module.exports = router;
