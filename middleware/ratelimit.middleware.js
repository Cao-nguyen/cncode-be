const rateLimit = require('express-rate-limit');

/**
 * Rate limiter cho các API chung (public endpoints)
 * Giới hạn: 5000 requests/15 phút mỗi IP (tăng từ 1000)
 * Skip cho admin users và health check
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5000, // Giới hạn 5000 requests mỗi windowMs
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút'
    },
    standardHeaders: true, // Trả về thông tin rate limit trong `RateLimit-*` headers
    legacyHeaders: false, // Tắt `X-RateLimit-*` headers
    // Skip rate limit cho health check và admin
    skip: (req) => req.path === '/health' || req.userRole === 'admin',
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

/**
 * Rate limiter nghiêm ngặt cho các API nhạy cảm (auth, payment, etc.)
 * Giới hạn: 50 requests/15 phút mỗi IP (tăng từ 10)
 * Skip cho admin users
 */
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 50, // Giới hạn 50 requests mỗi windowMs
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu đăng nhập/đăng ký, vui lòng thử lại sau 15 phút'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.userRole === 'admin',
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

/**
 * Rate limiter cho API upload
 * Giới hạn: 500 requests/15 phút mỗi IP (tăng từ 200)
 * Skip cho admin
 */
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 500, // Giới hạn 500 uploads mỗi windowMs
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu upload, vui lòng thử lại sau'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.userRole === 'admin',
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều yêu cầu upload, vui lòng thử lại sau 15 phút',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

/**
 * Rate limiter cho API gửi email
 * Giới hạn: 10 requests/60 phút mỗi IP
 */
const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 60 phút
    max: 10, // Giới hạn 10 emails mỗi windowMs
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu gửi email, vui lòng thử lại sau 1 giờ'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều yêu cầu gửi email, vui lòng thử lại sau 1 giờ',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

/**
 * Rate limiter cho API tạo shortlink
 * KHÔNG giới hạn - cho phép bên ngoài dùng API tự do
 * Chỉ chặn khi phát hiện pattern bất thường (DDoS, spam)
 */
const shortlinkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 10000, // Giới hạn rất cao 10000 shortlinks mỗi windowMs
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu tạo shortlink, vui lòng thử lại sau'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.userRole === 'admin',
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều yêu cầu tạo shortlink, vui lòng thử lại sau 15 phút',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

/**
 * Rate limiter cho Admin API
 * Giới hạn: 5000 requests/15 phút mỗi IP (tăng từ 2000)
 * Skip cho authenticated admin users
 */
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5000, // Giới hạn 5000 requests mỗi windowMs
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu từ admin, vui lòng thử lại sau 15 phút'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.userRole === 'admin',
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

module.exports = {
    generalLimiter,
    strictLimiter,
    uploadLimiter,
    emailLimiter,
    shortlinkLimiter,
    adminLimiter
};