// server.js (phần đầu)
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

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://cncode.io.vn',
  'https://cncode.vercel.app',
  'http://103.249.117.228:19984',
];

// Cấu hình Socket.IO
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  },
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
});

app.set('io', io);

// Cấu hình Express middleware
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Import session middleware
const sessionMiddleware = require('./middleware/session.middleware');
const { socketSessionMiddleware } = require('./middleware/session.middleware');

// Dùng session middleware cho Express
app.use(sessionMiddleware);

// Dùng session middleware cho Socket.IO (phiên bản không dùng res)
io.use(socketSessionMiddleware);

const statisticController = require('./modules/statistic/statistic.controller');

// AFFILIATE MIDDLEWARE
const affiliateMiddleware = require('./middleware/affiliate.middleware');
app.use(affiliateMiddleware);

// Track Visit Middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/s/')) return next();
  return statisticController.trackVisit(req, res, next);
});

// Socket.IO connection handlers
io.on('connection', (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);

  // Lấy session từ request
  const sessionId = socket.request.sessionId;
  const session = socket.request.session;

  if (session) {
    console.log(`Session ID: ${session.id}`);
  }

  // ========== PING/PONG HANDLERS ==========
  socket.on('ping', () => {
    socket.emit('pong');
  });

  socket.on('heartbeat', (data) => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // ========== REGISTER HANDLER ==========
  socket.on('register', (data) => {
    console.log(`📝 Register:`, data);
    // Lưu thông tin user online
    socket.data = { ...socket.data, ...data };

    // Phát sự kiện user_online cho tất cả client
    if (data.userId) {
      io.emit('user_online', {
        userId: data.userId,
        fullName: data.fullName || 'User',
        avatar: data.avatar,
        role: data.role,
        device: data.device
      });
    }
  });

  // ========== USER ACTIVITY ==========
  socket.on('user_activity', (data) => {
    // Cập nhật last active time
    socket.data.lastActive = Date.now();
  });

  // ========== ROOM HANDLERS ==========
  socket.on('join_post_room', ({ postSlug }) => {
    socket.join(`post:${postSlug}`);
    console.log(`📚 Socket ${socket.id} joined post:${postSlug}`);
  });

  socket.on('leave_post_room', ({ postSlug }) => {
    socket.leave(`post:${postSlug}`);
    console.log(`📚 Socket ${socket.id} left post:${postSlug}`);
  });

  // ========== DISCONNECT ==========
  socket.on('disconnect', (reason) => {
    console.log(`🔴 Client disconnected: ${socket.id}, reason: ${reason}`);

    // Xóa user khỏi online list
    if (socket.data?.userId) {
      io.emit('user_offline', { userId: socket.data.userId });
    }
  });

  socket.on('error', (error) => {
    console.error(`⚠️ Socket error for ${socket.id}:`, error.message);
  });
});

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// Routes
const shortlinkRoutes = require('./modules/shortlink/shortlink.routes');
app.use('/', shortlinkRoutes);

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/notifications', require('./modules/notification/notification.routes'));
app.use('/api', require('./modules/statistic/statistic.routes'));
app.use('/api/users', require('./modules/user/user.routes'));
app.use('/api/affiliate', require('./modules/affiliate/affiliate.routes'));
app.use('/api/ratings', require('./modules/rating/rating.route'));
app.use('/api/feedback', require('./modules/feedback/feedback.routes'));
app.use('/api/vouchers', require('./modules/voucher/voucher.routes'));

// Khởi tạo service analytics cho Socket
const analyticsService = require('./services/analytics.service');
analyticsService.init(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

const getIo = () => io;
module.exports = { getIo };