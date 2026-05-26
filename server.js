const dns = require('node:dns');

// Force DNS + IPv4
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

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// CORS
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://cncode.io.vn',
  'https://cncode.vercel.app',
  'http://103.249.117.228:19984',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id']
}));

// Socket.IO
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
const statisticService = require('./modules/statistic/statistic.service');

app.set('io', io);

// Routes
app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/notifications', require('./modules/notification/notification.routes'));
app.use('/api', require('./modules/statistic/statistic.routes'));
app.use('/api/users', require('./modules/user/user.routes'));
app.use('/api/affiliate', require('./modules/affiliate/affiliate.routes'));
app.use('/api/ratings', require('./modules/rating/rating.route'));
app.use('/api/feedback', require('./modules/feedback/feedback.routes'));
app.use('/api/vouchers', require('./modules/voucher/voucher.routes'));
app.use('/', require('./modules/shortlink/shortlink.routes'));
app.use('/api/comments', require('./modules/comment/comment.routes'));
app.use('/api/public/settings', require('./modules/setting/public.routes'));
app.use('/api/settings', require('./modules/setting/setting.routes'));
app.use('/api/upload', require('./modules/upload/upload.routes'));
app.use('/api/helpcenter', require('./modules/helpcenter/helpcenter.routes'));
app.use('/api/linked-products', require('./modules/linkedProduct/linkedProduct.routes'));
app.use('/api/faq', require('./modules/faq/faq.routes'));
app.use('/api/admin/sendmail', require('./modules/sendmail/sendmail.routes'));
app.use('/api/garden', require('./modules/garden/garden.routes'));
app.use('/api/help-project', require('./modules/helpproject/helpproject.routes'));

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

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        mongodb: mongoose.connection.readyState
      });
    });

    analyticsService.init(io);

    // Public stats
    app.get('/api/public/stats', async (req, res) => {
      try {
        const stats = await statisticService.getStats();

        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        console.error('Error getting stats:', error);

        res.status(500).json({
          success: false,
          message: 'Error fetching stats'
        });
      }
    });

    // Online stats
    app.get('/api/online-stats', (req, res) => {
      try {
        const stats = analyticsService.getOnlineStats();

        res.json(stats);
      } catch (error) {
        console.error('Error getting online stats:', error);

        res.status(500).json({
          success: false,
          message: 'Error fetching online stats'
        });
      }
    });

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

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received');

  await mongoose.connection.close();

  io.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});

module.exports = { app, server, io };