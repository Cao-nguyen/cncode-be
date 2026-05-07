// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://cncode.io.vn',
  'https://cncode.vercel.app',
];

const io = socketIo(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set('io', io);

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const sessionMiddleware = require('./middleware/session.middleware');
const statisticController = require('./modules/statistic/statistic.controller');

app.use(sessionMiddleware);

// AFFILIATE MIDDLEWARE
const affiliateMiddleware = require('./middleware/affiliate.middleware');
app.use(affiliateMiddleware);

app.use((req, res, next) => {
  if (req.path.startsWith('/s/')) return next();
  return statisticController.trackVisit(req, res, next);
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// Routes
const shortlinkRoutes = require('./modules/shortlink/shortlink.routes');
app.use('/', shortlinkRoutes);

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/notifications', require('./modules/notification/notification.routes'));
app.use('/api/digital-products', require('./modules/digital-product/digital-product.routes'));
app.use('/api/payments', require('./modules/payment/payment.routes'));
app.use('/api/upload', require('./modules/upload/upload.routes'));
app.use('/api/posts', require('./modules/post/post.routes'));
app.use('/api', require('./modules/statistic/statistic.routes'));
app.use('/api/users', require('./modules/user/user.routes'));
app.use('/api/dashboard', require('./modules/dashboard/dashboard.routes'));
app.use('/api/activities', require('./modules/activity/activity.routes'));
app.use('/api/system-settings', require('./modules/system-settings/system-settings.routes'));
app.use('/api/faq', require('./modules/faq/faq.routes'));
app.use('/api/affiliate', require('./modules/affiliate/affiliate.routes'));
app.use('/api/ratings', require('./modules/rating/rating.route'));
app.use('/api/feedback', require('./modules/feedback/feedback.routes'));

// Khởi tạo service analytics
const analyticsService = require('./services/analytics.service');
analyticsService.init(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

const getIo = () => io;
module.exports = { getIo };