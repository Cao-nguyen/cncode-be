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

// ================= SOCKET =================
const io = socketIo(server, {
  cors: {
    origin: true, // ✅ fix cors
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ================= MIDDLEWARE =================
app.use(cors({
  origin: true, // ✅ fix cors
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ================= SESSION + TRACK =================
const sessionMiddleware = require('./middleware/session.middleware');
const statisticController = require('./modules/statistic/statistic.controller');

app.use(sessionMiddleware);

// ✅ FIX: không track route redirect
app.use((req, res, next) => {
  if (req.path.startsWith('/s/')) return next();
  return statisticController.trackVisit(req, res, next);
});

// ================= DATABASE =================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// ================= ROUTES =================
app.use('/api/auth', require('./modules/auth/auth.routes'));
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
app.use('/api', require('./modules/shortlink/shortlink.routes'));

// ================= ONLINE SOCKET =================
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
      userId,
      sessionId: data.sessionId
    });
  }

  io.emit('online_stats', stats);
};

io.on('connection', (socket) => {
  console.log('🟢 Connected:', socket.id);

  let currentUserId = null;

  socket.on('register', (data) => {
    const userId = data?.userId || null;
    const sessionId = data?.sessionId || null;

    currentUserId = userId;

    if (userId) {
      socket.join(`user_${userId}`);

      if (onlineGuests.has(socket.id)) {
        onlineGuests.delete(socket.id);
      }

      onlineUsers.set(userId, {
        socketId: socket.id,
        sessionId,
        connectedAt: new Date()
      });

      socketToUser.set(socket.id, userId);
      socket.emit('registered', { success: true });

    } else {
      if (sessionId) {
        onlineGuests.set(socket.id, {
          sessionId,
          connectedAt: new Date()
        });
      }
    }

    broadcastOnlineStats();
  });

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);

    if (userId) {
      onlineUsers.delete(userId);
      socketToUser.delete(socket.id);
    } else {
      onlineGuests.delete(socket.id);
    }

    broadcastOnlineStats();
  });

  socket.on('ping', () => {
    const userId = socketToUser.get(socket.id);

    if (userId) {
      const user = onlineUsers.get(userId);
      if (user) user.connectedAt = new Date();
    } else {
      const guest = onlineGuests.get(socket.id);
      if (guest) guest.connectedAt = new Date();
    }
  });
});

// ================= CLEAN DEAD CONNECTION =================
setInterval(() => {
  const now = new Date();
  let changed = false;

  for (const [socketId, data] of onlineGuests.entries()) {
    if ((now - data.connectedAt) / 1000 > 15) {
      onlineGuests.delete(socketId);
      changed = true;
    }
  }

  for (const [userId, data] of onlineUsers.entries()) {
    if ((now - data.connectedAt) / 1000 > 15) {
      onlineUsers.delete(userId);
      socketToUser.delete(data.socketId);
      changed = true;
    }
  }

  if (changed) broadcastOnlineStats();
}, 5000);

// ================= API =================
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

// ================= ROOT =================
app.get('/', (req, res) => {
  res.json({
    message: 'CNcode API running',
    online: onlineUsers.size + onlineGuests.size
  });
});

// ================= START =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});