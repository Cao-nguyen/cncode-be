const router = require('express').Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const sendmailController = require('./sendmail.controller');
const { emailLimiter, generalLimiter } = require('../../middleware/ratelimit.middleware');
const { heavyQueueMiddleware } = require('../../middleware/queue.middleware');

// Apply heavy queue for sendmail routes
router.use(heavyQueueMiddleware);

router.use(authenticate);
router.use(authorize('admin'));

// GET /users — use general limiter (only listing users)
router.get('/users', generalLimiter, sendmailController.getUsers);

// POST /send — use strict email limiter (10 req / 60 min)
router.post('/send', emailLimiter, sendmailController.sendBulkEmail);

module.exports = router;