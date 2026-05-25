const router = require('express').Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const sendmailController = require('./sendmail.controller');

// ✅ Đảm bảo middleware được áp dụng đúng
router.use(authenticate);
router.use(authorize('admin'));

// ✅ Check đường dẫn
router.get('/users', sendmailController.getUsers);      // GET /api/admin/sendmail/users
router.post('/send', sendmailController.sendBulkEmail); // POST /api/admin/sendmail/send

module.exports = router;