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
const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://cncode.vercel.app',
      'https://cncode.io.vn',
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://cncode.vercel.app',
    'https://cncode.io.vn',
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const sessionMiddleware = require('./middleware/session.middleware');
const statisticController = require('./modules/statistic/statistic.controller');

app.use(sessionMiddleware);
app.use(statisticController.trackVisit);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/digital-products', require('./modules/digital-product/digital-product.routes'));
app.use('/api/payments', require('./modules/payment/payment.routes'));
app.use('/api/upload', require('./modules/upload/upload.routes'));
app.use('/api/posts', require('./modules/post/post.routes'));
app.use('/api', require('./modules/statistic/statistic.routes'));
app.use('/api/users', require('./modules/user/user.routes'));
app.use('/shortlink', require('./modules/shortlink/shortlink.routes'));
app.use('/api/dashboard', require('./modules/dashboard/dashboard.routes'));
app.use('/api/activities', require('./modules/activity/activity.routes'));
app.use('/api/system-settings', require('./modules/system-settings/system-settings.routes'));
app.use('/api/faq', require('./modules/faq/faq.routes'));

const onlineGuests = new Map();
const onlineUsers = new Map();
const socketToUser = new Map();

const broadcastOnlineStats = () => {
  const stats = {
    total: onlineGuests.size + onlineUsers.size,
    guests: onlineGuests.size,
    users: onlineUsers.size,
    userList: []
  };

  for (const [userId, data] of onlineUsers.entries()) {
    stats.userList.push({
      userId: userId,
      sessionId: data.sessionId
    });
  }

  io.emit('online_stats', stats);
};

io.on('connection', (socket) => {
  console.log('🟢 New client connected:', socket.id);
  let currentUserId = null;
  let currentSessionId = null;

  socket.on('register', (data) => {
    const userId = data?.userId || null;
    const sessionId = data?.sessionId || null;

    console.log(`📝 Register event - userId: ${userId}, sessionId: ${sessionId}`);

    currentSessionId = sessionId;

    // ✅ Nếu đã từng đăng ký userId khác → dọn dẹp
    if (currentUserId && currentUserId !== userId) {
      if (onlineUsers.has(currentUserId)) {
        onlineUsers.delete(currentUserId);
      }
      socketToUser.delete(socket.id);
    }

    currentUserId = userId;

    if (userId) {
      // ✅ User đã đăng nhập → join room riêng theo userId (QUAN TRỌNG)
      socket.join(`user_${userId}`);
      console.log(`✅ User ${userId} joined room user_${userId}`);
      console.log(`📢 Socket rooms:`, Array.from(socket.rooms));

      // Dọn khỏi guest nếu trước đó là guest
      if (onlineGuests.has(socket.id)) {
        onlineGuests.delete(socket.id);
      }

      onlineUsers.set(userId, {
        socketId: socket.id,
        sessionId: sessionId,
        connectedAt: new Date()
      });
      socketToUser.set(socket.id, userId);

      // Xác nhận đã đăng ký thành công
      socket.emit('registered', { userId, success: true });
    } else {
      // Guest user
      const existingUserId = socketToUser.get(socket.id);
      if (existingUserId) {
        onlineUsers.delete(existingUserId);
        socketToUser.delete(socket.id);
      }

      // Chỉ track guest nếu có sessionId
      if (sessionId) {
        onlineGuests.set(socket.id, {
          sessionId: sessionId,
          connectedAt: new Date()
        });
      }
    }

    broadcastOnlineStats();
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
    const userId = socketToUser.get(socket.id);

    if (userId) {
      if (onlineUsers.has(userId)) {
        onlineUsers.delete(userId);
      }
      socketToUser.delete(socket.id);
    } else {
      if (onlineGuests.has(socket.id)) {
        onlineGuests.delete(socket.id);
      }
    }

    if (currentUserId) {
      socketToUser.delete(socket.id);
    }

    broadcastOnlineStats();
  });

  socket.on('ping', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      const userData = onlineUsers.get(userId);
      if (userData) {
        userData.connectedAt = new Date();
        onlineUsers.set(userId, userData);
      }
    } else {
      const guestData = onlineGuests.get(socket.id);
      if (guestData) {
        guestData.connectedAt = new Date();
        onlineGuests.set(socket.id, guestData);
      }
    }
  });
});

setInterval(() => {
  const now = new Date();
  let changed = false;

  for (const [socketId, data] of onlineGuests.entries()) {
    const diffSeconds = (now - data.connectedAt) / 1000;
    if (diffSeconds > 15) {
      onlineGuests.delete(socketId);
      changed = true;
    }
  }

  for (const [userId, data] of onlineUsers.entries()) {
    const diffSeconds = (now - data.connectedAt) / 1000;
    if (diffSeconds > 15) {
      onlineUsers.delete(userId);
      socketToUser.delete(data.socketId);
      changed = true;
    }
  }

  if (changed) {
    broadcastOnlineStats();
  }
}, 5000);

app.get('/api/online-stats', (req, res) => {
  res.json({
    success: true,
    data: {
      total: onlineGuests.size + onlineUsers.size,
      guests: onlineGuests.size,
      users: onlineUsers.size,
      userList: Array.from(onlineUsers.keys())
    }
  });
});

app.set('io', io);
app.set('onlineGuests', onlineGuests);
app.set('onlineUsers', onlineUsers);
app.set('socketToUser', socketToUser);

app.get('/', (req, res) => {
  res.json({
    message: 'CNcode API is running',
    stats: {
      onlineUsers: onlineUsers.size,
      onlineGuests: onlineGuests.size,
      totalOnline: onlineUsers.size + onlineGuests.size
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});