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
  credentials: true
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

// Routes
app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/digital-products', require('./modules/digital-product/digital-product.routes'));
app.use('/api/payments', require('./modules/payment/payment.routes'));
app.use('/api/upload', require('./modules/upload/upload.routes'));
app.use('/api/posts', require('./modules/post/post.routes'));
app.use('/api', require('./modules/statistic/statistic.routes'));

// Store online users and guests separately
const onlineGuests = new Map(); // socketId -> { sessionId, connectedAt }
const onlineUsers = new Map(); // userId -> { socketId, sessionId, connectedAt }
const socketToUser = new Map(); // socketId -> userId (để dễ dàng tra cứu)

// Broadcast online stats to all clients
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
  console.log(`📊 Broadcast - Users: ${onlineUsers.size}, Guests: ${onlineGuests.size}, Total: ${onlineUsers.size + onlineGuests.size}`);
};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  let currentUserId = null;
  let currentSessionId = null;

  // Client đăng ký với userId và sessionId
  socket.on('register', (data) => {
    const userId = data?.userId || null;
    const sessionId = data?.sessionId || null;

    console.log(`📝 Register request - Socket: ${socket.id}, UserId: ${userId || 'null'}, SessionId: ${sessionId?.substring(0, 8)}...`);

    if (!sessionId) {
      console.log(`⚠️ Client ${socket.id} registered without sessionId`);
      return;
    }

    currentSessionId = sessionId;

    // Nếu đã có userId cũ và khác với userId mới, xóa cũ
    if (currentUserId && currentUserId !== userId) {
      console.log(`🔄 User changed from ${currentUserId} to ${userId || 'guest'}`);
      if (onlineUsers.has(currentUserId)) {
        onlineUsers.delete(currentUserId);
      }
      socketToUser.delete(socket.id);
    }

    currentUserId = userId;

    if (userId) {
      // Đã đăng nhập - là USER
      // Xóa khỏi guest nếu có
      if (onlineGuests.has(socket.id)) {
        onlineGuests.delete(socket.id);
        console.log(`🗑️ Removed from guests: ${socket.id}`);
      }

      // Thêm hoặc cập nhật user
      onlineUsers.set(userId, {
        socketId: socket.id,
        sessionId: sessionId,
        connectedAt: new Date()
      });
      socketToUser.set(socket.id, userId);

      console.log(`✅ USER online: ${userId} (${sessionId.substring(0, 8)}...)`);
    } else {
      // Chưa đăng nhập - là GUEST
      // Kiểm tra xem socket này đã là user chưa
      const existingUserId = socketToUser.get(socket.id);
      if (existingUserId) {
        console.log(`⚠️ Socket ${socket.id} was user ${existingUserId}, now guest - removing from users`);
        onlineUsers.delete(existingUserId);
        socketToUser.delete(socket.id);
      }

      // Thêm vào guest
      onlineGuests.set(socket.id, {
        sessionId: sessionId,
        connectedAt: new Date()
      });

      console.log(`👤 GUEST online: ${sessionId.substring(0, 8)}...`);
    }

    // Broadcast cập nhật
    broadcastOnlineStats();
  });

  // Xử lý disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    const userId = socketToUser.get(socket.id);

    if (userId) {
      // Xóa user
      if (onlineUsers.has(userId)) {
        onlineUsers.delete(userId);
        console.log(`❌ User offline: ${userId}`);
      }
      socketToUser.delete(socket.id);
    } else {
      // Xóa guest
      if (onlineGuests.has(socket.id)) {
        const guestData = onlineGuests.get(socket.id);
        const sessionIdShort = guestData?.sessionId?.substring(0, 8) || 'unknown';
        onlineGuests.delete(socket.id);
        console.log(`❌ Guest offline: ${sessionIdShort}...`);
      }
    }

    if (currentUserId) {
      socketToUser.delete(socket.id);
    }

    // Broadcast cập nhật
    broadcastOnlineStats();
  });

  // Ping để giữ kết nối
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

// Cleanup stale connections every 5 seconds
setInterval(() => {
  const now = new Date();
  let changed = false;

  // Clean up guests
  for (const [socketId, data] of onlineGuests.entries()) {
    const diffSeconds = (now - data.connectedAt) / 1000;
    if (diffSeconds > 15) {
      const sessionIdShort = data.sessionId?.substring(0, 8) || 'unknown';
      console.log(`🗑️ Removing stale guest: ${sessionIdShort}...`);
      onlineGuests.delete(socketId);
      changed = true;
    }
  }

  // Clean up users
  for (const [userId, data] of onlineUsers.entries()) {
    const diffSeconds = (now - data.connectedAt) / 1000;
    if (diffSeconds > 15) {
      console.log(`🗑️ Removing stale user: ${userId}`);
      onlineUsers.delete(userId);
      socketToUser.delete(data.socketId);
      changed = true;
    }
  }

  if (changed) {
    broadcastOnlineStats();
  }
}, 5000);

// API để lấy online stats
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
  console.log(`📊 Monitoring online users every 5 seconds...`);
});