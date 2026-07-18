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
global.io = io; // Make io available globally for cron jobs

io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

  console.log('🔐 Socket middleware - Token present:', !!token);

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      console.log('✅ Socket middleware - User authenticated:', socket.userId);
    } catch (error) {
      console.log('⚠️ Invalid token for socket connection:', error.message);
    }
  } else {
    console.log('⚠️ No token provided for socket connection');
  }

  next();
});

setupChatSocket(io);
setupAdminChatSocket(io);

app.get('/api/queue-stats', queueStatsMiddleware);

// Public routes (no /api prefix)
app.use('/', require('./user.routes'));

// User routes (with /api prefix)
app.use('/api', require('./user.routes'));

// Admin routes
app.use('/api/admin', require('./admin.routes'));

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

    // Start streak reset cron job
    require('./workers/streak.cron');

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