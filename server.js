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

// Dùng session middleware cho Socket.IO
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

// Khởi tạo service analytics cho Socket (service này tự xử lý tất cả socket events)
const analyticsService = require('./services/analytics.service');
analyticsService.init(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

const getIo = () => io;
module.exports = { getIo };