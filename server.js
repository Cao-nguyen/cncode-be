const dns = require('dns');

// FORCE IPv4
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS Configuration
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://cncode.io.vn',
  'https://cncode.vercel.app',
  'http://103.249.117.228:19984',
  process.env.FRONTEND_URL
].filter(Boolean);

// Socket.IO Configuration
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Session-Id'
    ]
  },
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 120000,
  pingInterval: 25000,
  connectTimeout: 45000,
  allowUpgrades: true,
  perMessageDeflate: {
    threshold: 1024
  }
});

app.set('io', io);

// Express Middleware
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Session-Id'
  ]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// MongoDB Connection
mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/cncode',
  {
    family: 4
  }
)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// Import Services
const analyticsService = require('./services/analytics.service');
const statisticService = require('./modules/statistic/statistic.service');

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

// Initialize Analytics Service
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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket path: /socket.io`);
  console.log(`🔗 Allowed origins:`, ALLOWED_ORIGINS);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');

  io.close(() => {
    server.close(() => {
      mongoose.connection.close();

      process.exit(0);
    });
  });
});

module.exports = { app, server, io };