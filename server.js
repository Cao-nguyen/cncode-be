const dns = require('node:dns');

dns.setServers(['1.1.1.1', '8.8.8.8']);
dns.setDefaultResultOrder('ipv4first');

process.env.NTBA_FIX_350 = 1;

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const { generalLimiter } = require('./middleware/ratelimit.middleware');
const { generalQueueMiddleware } = require('./middleware/queue.middleware');

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use(cookieParser());

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://cncode.io.vn',
  'https://cncode.vercel.app',
  'http://103.249.117.228:19984',
  'http://192.168.1.5:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id']
}));

app.use(generalLimiter);
app.use(generalQueueMiddleware);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  },
  path: '/socket.io',
  transports: ['websocket', 'polling'],
});

const analyticsService = require('./services/analytics.service');
const socketService = require('./services/socket.service');
const { queueStatsMiddleware } = require('./middleware/queue.middleware');
const { setupChatSocket } = require('./modules/chat/chat.socket');
const { setupAdminChatSocket } = require('./modules/adminchat/adminchat.socket');
const jwt = require('jsonwebtoken');

socketService.setIO(io);

app.set('io', io);

io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
    } catch (error) {
      console.log('⚠️ Invalid token for socket connection:', error.message);
    }
  }

  next();
});

setupChatSocket(io);
setupAdminChatSocket(io);

app.get('/api/queue-stats', queueStatsMiddleware);

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/notifications', require('./modules/notification/notification.routes'));
app.use('/api/statistic', require('./modules/statistic/statistic.routes'));
app.use('/api/users', require('./modules/user/user.routes'));
app.use('/api/affiliate', require('./modules/affiliate/affiliate.routes'));
app.use('/api/ratings', require('./modules/rating/rating.route'));
app.use('/api/reviews', require('./modules/review/review.route'));
app.use('/api/feedback', require('./modules/feedback/feedback.routes'));
app.use('/', require('./modules/shortlink/shortlink.routes'));
app.use('/api/comments', require('./modules/comment/comment.routes'));
app.use('/api/public/settings', require('./modules/setting/public.routes'));
app.use('/api/settings', require('./modules/setting/setting.routes'));
app.use('/api/upload', require('./modules/upload/upload.routes'));
app.use('/api/payment', require('./modules/khoahoc/payment.routes'));
app.use('/api/khoahoc', require('./modules/khoahoc/khoahoc.routes'));
app.use('/api/teacher', require('./modules/khoahoc/teacher.routes'));
app.use('/api/admin/khoahoc', require('./modules/khoahoc/admin.routes'));
app.use('/api/helpcenter', require('./modules/helpcenter/helpcenter.routes'));
app.use('/api/linked-products', require('./modules/linkedProduct/linkedProduct.routes'));
app.use('/api/faq', require('./modules/faq/faq.routes'));
app.use('/api/user', require('./modules/user/user.routes'));
app.use('/api/chat', require('./modules/chat/chat.routes'));
app.use('/api/admin/sendmail', require('./modules/sendmail/sendmail.routes'));
app.use('/api/garden', require('./modules/garden/garden.routes'));
app.use('/api/help-project', require('./modules/helpproject/helpproject.routes'));
app.use('/api/cnbooks', require('./modules/cnbook/cnbook.routes'));
app.use('/api/blog', require('./modules/blog/blog.routes'));
app.use('/api/slideshow', require('./modules/slideshow/slideshow.routes'));
app.use('/api/cross-promotion', require('./modules/cross-promotion/cross-promotion.routes'));
app.use('/api/push', require('./modules/push-subscription/push-subscription.routes'));
app.use('/api/adminchat', require('./modules/adminchat/adminchat.routes'));
app.use('/api/baihoc', require('./modules/baihoc/baihoc.routes'));
app.use('/api/tiendo', require('./modules/tiendo/tiendo.routes'));
app.use('/api/baitap', require('./modules/baitap/baitap.routes'));
app.use('/api/luyentap', require('./modules/luyentap/luyentap.routes'));
app.use('/api/huongnghiep', require('./modules/huongnghiep/huongnghiep.routes'));
app.use('/api/gifts', require('./modules/gift/gift.routes'));
app.use('/api/forum', require('./modules/forum/forum.routes'));
app.use('/api/aitutor', require('./modules/aitutor/aitutor.routes'));
app.use('/api/chatwithadmin', require('./modules/chatwithadmin/chatwithadmin.routes'));
app.use('/api/test-up', require('./modules/upload/encrypted-file.routes'));

const bootstrap = async () => {
  try {
    console.log('⏳ Connecting to MongoDB...');

    await mongoose.connect(process.env.MONGODB_URI, {
      family: 4,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });

    console.log('✅ Connected to MongoDB');

    // Initialize WebSocket for upload progress
    const wsUploadService = require('./services/websocket-upload.service');
    wsUploadService.init(server);
    console.log('✅ WebSocket upload service initialized');

    // Initialize Telegram client
    const telegramClient = require('./services/telegram-client.service');
    await telegramClient.initialize();
    console.log('✅ Telegram client initialized');

    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        mongodb: mongoose.connection.readyState
      });
    });

    analyticsService.init(io);

    const reminderService = require('./services/reminderService');
    reminderService.start();

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  }
};

bootstrap();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received');

  const reminderService = require('./services/reminderService');
  reminderService.stop();

  await mongoose.connection.close();

  io.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});

module.exports = { app, server, io };