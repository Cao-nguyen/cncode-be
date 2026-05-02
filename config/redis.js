// config/redis.js
const Redis = require('ioredis');

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true, // ✅ Không kết nối ngay, tránh crash khi start
    enableOfflineQueue: false, // ✅ Không queue lệnh khi offline → throw error ngay
    retryStrategy: (times) => {
        if (times > 3) {
            console.error('❌ Redis: Không thể kết nối, bỏ qua');
            return null; // Dừng retry
        }
        return Math.min(times * 500, 2000);
    },
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('ready', () => console.log('✅ Redis ready'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));
redis.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));

// Thử connect, nếu lỗi thì bỏ qua (không crash app)
redis.connect().catch(() => {
    console.warn('⚠️ Redis không khả dụng - app vẫn chạy bình thường');
});

module.exports = redis;