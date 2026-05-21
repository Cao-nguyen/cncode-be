const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const { sessionMiddleware, socketSessionMiddleware } = require('./middleware/session.middleware');
const statisticController = require('./modules/statistic/statistic.controller');
const analyticsService = require('./services/analytics.service');

dotenv.config();
const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://cncode.io.vn',
  'https://cncode.vercel.app'
];

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"], credentials: true },
  path: '/socket.io',
  transports: ['websocket', 'polling']
});

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);
io.use(socketSessionMiddleware);

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return statisticController.trackVisit(req, res, next);
});

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ MongoDB Connected'));

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api', require('./modules/statistic/statistic.routes'));
app.use('/api/users', require('./modules/user/user.routes'));

analyticsService.init(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));