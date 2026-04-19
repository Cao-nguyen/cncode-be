const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');

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

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/digital-products', require('./modules/digital-product/digital-product.routes'));
app.use('/api/payments', require('./modules/payment/payment.routes'));
app.use('/api/upload', require('./modules/upload/upload.routes'));
app.use('/api/posts', require('./modules/post/post.routes'));

const users = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('register', (userId) => {
    users.set(userId, socket.id);
    socket.join(userId); // ✅ Thêm dòng này để io.to(userId).emit() hoạt động
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of users.entries()) {
      if (socketId === socket.id) {
        users.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

app.set('io', io);
app.set('users', users);

app.get('/', (req, res) => {
  res.json({ message: 'CNcode API is running' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});