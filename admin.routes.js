const express = require('express');
const router = express.Router();

// Reviews (admin routes)
router.use('/reviews', require('./modules/review/review.routes.admin'));

// Settings (admin)
router.use('/system-settings', require('./modules/systemSettings/systemSettings.routes.admin'));

// Courses admin
router.use('/khoahoc', require('./modules/khoahoc/admin.routes'));

// Linked products (admin routes)
router.use('/linked-products', require('./modules/linkedProduct/linkedProduct.routes.admin'));

// Help center (admin routes)
router.use('/helpcenter', require('./modules/helpcenter/helpcenter.routes.admin'));

// Feedback (admin routes)
router.use('/feedback', require('./modules/feedback/feedback.routes.admin'));

// FAQ (admin routes)
router.use('/faq', require('./modules/faq/faq.routes.admin'));

// Shortlink (admin routes)
router.use('/shortlink', require('./modules/shortlink/shortlink.routes.admin'));

// Help project (admin routes)
router.use('/helpproject', require('./modules/helpproject/helpproject.routes.admin'));

// Send mail
router.use('/sendmail', require('./modules/sendmail/sendmail.routes'));

// Test upload
router.use('/test-up', require('./modules/upload/encrypted-file.routes'));

module.exports = router;
