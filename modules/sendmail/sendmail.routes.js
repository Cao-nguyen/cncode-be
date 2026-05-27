const router = require('express').Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const sendmailController = require('./sendmail.controller');

router.use(authenticate);
router.use(authorize('admin'));

router.get('/users', sendmailController.getUsers);      
router.post('/send', sendmailController.sendBulkEmail); 

module.exports = router;
