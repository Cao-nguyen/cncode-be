const express = require('express');
const router = express.Router();

// Auth
router.use('/auth', require('./modules/auth/auth.routes'));

// Notifications
router.use('/notifications', require('./modules/notification/notification.routes'));

// Statistics
router.use('/statistic', require('./modules/statistic/statistic.routes'));

// Users
router.use('/users', require('./modules/user/user.routes'));
router.use('/user', require('./modules/user/user.routes'));

// Friend requests
router.use('/friend-requests', require('./modules/friendrequest/friendrequest.routes'));

// Affiliate
router.use('/affiliate', require('./modules/affiliate/affiliate.routes'));

// Reviews (user routes)
router.use('/reviews', require('./modules/review/review.routes.user'));

// Feedback
router.use('/feedback', require('./modules/feedback/feedback.routes.user'));

// Comments
router.use('/comments', require('./modules/comment/comment.routes'));

// Settings (public)
router.use('/system-settings/public', require('./modules/systemSettings/systemSettings.routes.user'));

// Upload
router.use('/upload', require('./modules/upload/upload.routes'));

// Payment
router.use('/payment', require('./modules/khoahoc/payment.routes'));

// Courses (khoahoc)
router.use('/khoahoc', require('./modules/khoahoc/khoahoc.routes'));
router.use('/teacher', require('./modules/khoahoc/teacher.routes'));

// Help center (user routes)
router.use('/helpcenter', require('./modules/helpcenter/helpcenter.routes.user'));

// Linked products (user routes)
router.use('/linked-products', require('./modules/linkedProduct/linkedProduct.routes.user'));

// FAQ
router.use('/faq', require('./modules/faq/faq.routes.user'));

// Chat
router.use('/chat', require('./modules/chat/chat.routes'));

// Garden
router.use('/garden', require('./modules/garden/garden.routes'));

// CN Books
router.use('/cnbooks', require('./modules/cnbook/cnbook.routes'));

// Blog
router.use('/blog', require('./modules/blog/blog.routes'));

// Slideshow
router.use('/slideshow', require('./modules/slideshow/slideshow.routes'));

// Cross promotion
router.use('/cross-promotion', require('./modules/cross-promotion/cross-promotion.routes'));

// Push subscription
router.use('/push', require('./modules/push-subscription/push-subscription.routes'));

// Admin chat (user side)
router.use('/adminchat', require('./modules/adminchat/adminchat.routes'));

// Lessons (baihoc)
router.use('/baihoc', require('./modules/baihoc/baihoc.routes'));
router.use('/exercise', require('./modules/baihoc/exercise.routes'));

// Progress (tiendo)
router.use('/tiendo', require('./modules/tiendo/tiendo.routes'));

// Exercises (baitap)
router.use('/baitap', require('./modules/baitap/baitap.routes'));

// Practice (luyentap)
router.use('/luyentap', require('./modules/luyentap/luyentap.routes'));

// Career (huongnghiep)
router.use('/huongnghiep', require('./modules/huongnghiep/huongnghiep.routes'));

// Gifts
router.use('/gifts', require('./modules/gift/gift.routes'));

// Forum
router.use('/forum', require('./modules/forum/forum.routes'));

// Explore (khampha)
router.use('/khampha', require('./modules/khampha/khampha.routes'));

// AI Tutor
router.use('/aitutor', require('./modules/aitutor/aitutor.routes'));

// Chat with admin
router.use('/chatwithadmin', require('./modules/chatwithadmin/chatwithadmin.routes'));

// Coins
router.use('/coins', require('./modules/coin/coin.routes'));

// Champions (dautruong)
router.use('/dautruong', require('./modules/dautruong/dautruong.routes'));

// Shop
router.use('/shop', require('./modules/shop/shop.routes'));

// Enrollment
router.use('/enrollment', require('./modules/enrollment/enrollment.routes'));

// Notes
router.use('/notes', require('./modules/notes/notes.routes'));

// Shortlink (user routes)
router.use('/', require('./modules/shortlink/shortlink.routes.public'));
router.use('/shortlink', require('./modules/shortlink/shortlink.routes.user'));

// Help project (user routes)
router.use('/helpproject', require('./modules/helpproject/helpproject.routes.user'));

module.exports = router;
