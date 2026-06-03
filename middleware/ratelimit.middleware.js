const rateLimit = require('express-rate-limit');

/**
 * Rate limiter cho các API chung
 * Giới hạn: 500 requests/15 phút mỗi IP
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 500, // Giới hạn 500 requests mỗi windowMs
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút'
    },
    standardHeaders: true, // Trả về thông tin rate limit trong `RateLimit-*` headers
    legacyHeaders: false, // Tắt `X-RateLimit-*` headers
    // Skip rate limit cho health check
    skip: (req) => req.path === '/health',
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
 * Giới hạn: 20 requests/15 phút mỗi IP
 */
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 20, // Giới hạn 20 requests mỗi windowMs
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu đăng nhập/đăng ký, vui lòng thử lại sau 15 phút'
    },
    standardHeaders: true,
    legacyHeaders: false,
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
 * Giới hạn: 50 requests/15 phút mỗi IP
 */
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 50, // Giới hạn 50 uploads mỗi windowMs
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu upload, vui lòng thử lại sau'
    },
    standardHeaders: true,
    legacyHeaders: false,
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
 * Giới hạn: 60 requests/15 phút mỗi IP
 */
const shortlinkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 60, // Giới hạn 60 shortlinks mỗi windowMs
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu tạo shortlink, vui lòng thử lại sau'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều yêu cầu tạo shortlink, vui lòng thử lại sau 15 phút',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

module.exports = {
    generalLimiter,
    strictLimiter,
    uploadLimiter,
    emailLimiter,
    shortlinkLimiter
};