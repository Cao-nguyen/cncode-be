const router = require('express').Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const sendmailController = require('./sendmail.controller');
const { emailLimiter } = require('../../middleware/ratelimit.middleware');
const { heavyQueueMiddleware } = require('../../middleware/queue.middleware');

// Apply email rate limiting and heavy queue for sendmail routes
router.use(emailLimiter);
router.use(heavyQueueMiddleware);

router.use(authenticate);
router.use(authorize('admin'));

router.get('/users', sendmailController.getUsers);
router.post('/send', sendmailController.sendBulkEmail);

module.exports = router;
