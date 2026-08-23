const rateLimit = require('express-rate-limit');

// Store để track suspicious activity
const suspiciousIPs = new Map();
const suspiciousUsers = new Map();

// Config
const SUSPICIOUS_THRESHOLD = 100; // Số requests trong 1 giây để mark là suspicious
const BLOCK_DURATION = 30 * 60 * 1000; // Block 30 phút
const MAX_FAILED_ATTEMPTS = 10; // Số lần failed auth trước khi block

/**
 * Middleware để detect và chặn request bất thường
 * Chỉ chặn khi phát hiện pattern bất thường (request quá nhanh, DDoS)
 */
const detectSuspiciousActivity = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.userId;
    const now = Date.now();

    // Track requests per IP
    if (!suspiciousIPs.has(ip)) {
        suspiciousIPs.set(ip, {
            requests: [], // Array of timestamps
            failedAttempts: 0,
            isBlocked: false,
            blockedUntil: 0
        });
    }

    const ipData = suspiciousIPs.get(ip);

    // Check if IP is blocked
    if (ipData.isBlocked && now < ipData.blockedUntil) {
        return res.status(429).json({
            success: false,
            message: 'IP của bạn đã bị tạm chặn do hoạt động bất thường',
            retryAfter: Math.ceil((ipData.blockedUntil - now) / 1000)
        });
    }

    // Reset block if expired
    if (ipData.isBlocked && now >= ipData.blockedUntil) {
        ipData.isBlocked = false;
        ipData.requests = [];
        ipData.failedAttempts = 0;
    }

    // Add current request timestamp
    ipData.requests.push(now);

    // Clean old requests (older than 1 second)
    const oneSecondAgo = now - 1000;
    ipData.requests = ipData.requests.filter(timestamp => timestamp > oneSecondAgo);

    // Check for suspicious pattern: too many requests in 1 second
    const requestsPerSecond = ipData.requests.length;
    
    if (requestsPerSecond > SUSPICIOUS_THRESHOLD) {
        console.warn(`[SECURITY] Suspicious activity detected from IP ${ip}: ${requestsPerSecond} req/s`);
        
        // Block IP immediately if >100 req/s
        ipData.isBlocked = true;
        ipData.blockedUntil = now + BLOCK_DURATION;
        console.warn(`[SECURITY] Blocking IP ${ip} for ${BLOCK_DURATION / 60000} minutes due to ${requestsPerSecond} req/s`);
        
        return res.status(429).json({
            success: false,
            message: 'IP của bạn đã bị tạm chặn do hoạt động bất thường (quá nhiều request)',
            retryAfter: Math.ceil(BLOCK_DURATION / 1000)
        });
    }

    // Track failed auth attempts
    if (req.path.includes('/auth/login') || req.path.includes('/auth/register')) {
        if (res.statusCode >= 400) {
            ipData.failedAttempts++;
            
            if (ipData.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                ipData.isBlocked = true;
                ipData.blockedUntil = now + BLOCK_DURATION;
                console.warn(`[SECURITY] Blocking IP ${ip} due to ${MAX_FAILED_ATTEMPTS} failed auth attempts`);
                
                return res.status(429).json({
                    success: false,
                    message: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau 30 phút',
                    retryAfter: Math.ceil(BLOCK_DURATION / 1000)
                });
            }
        }
    }

    // Track suspicious users (if authenticated)
    if (userId) {
        if (!suspiciousUsers.has(userId)) {
            suspiciousUsers.set(userId, {
                requests: [],
                isBlocked: false,
                blockedUntil: 0
            });
        }

        const userData = suspiciousUsers.get(userId);
        userData.requests.push(now);

        // Clean old requests
        userData.requests = userData.requests.filter(timestamp => timestamp > oneSecondAgo);

        // Check if user is blocked
        if (userData.isBlocked && now < userData.blockedUntil) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản của bạn đã bị tạm khóa do hoạt động bất thường',
                retryAfter: Math.ceil((userData.blockedUntil - now) / 1000)
            });
        }

        // Block user if >100 req/s
        if (userData.requests.length > SUSPICIOUS_THRESHOLD) {
            userData.isBlocked = true;
            userData.blockedUntil = now + BLOCK_DURATION;
            console.warn(`[SECURITY] Blocking user ${userId} due to ${userData.requests.length} req/s`);
        }
    }

    next();
};

/**
 * Cleanup old entries periodically
 */
const cleanupOldEntries = () => {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    // Clean IP entries older than 1 hour and not blocked
    for (const [ip, data] of suspiciousIPs.entries()) {
        if (!data.isBlocked && data.requests.length === 0 && (now - data.requests[data.requests.length - 1]) > ONE_HOUR) {
            suspiciousIPs.delete(ip);
        }
    }

    // Clean user entries older than 1 hour and not blocked
    for (const [userId, data] of suspiciousUsers.entries()) {
        if (!data.isBlocked && data.requests.length === 0 && (now - data.requests[data.requests.length - 1]) > ONE_HOUR) {
            suspiciousUsers.delete(userId);
        }
    }
};

// Run cleanup every 5 minutes
setInterval(cleanupOldEntries, 5 * 60 * 1000);

/**
 * Manual unblock function (for admin use)
 */
const unblockIP = (ip) => {
    if (suspiciousIPs.has(ip)) {
        const data = suspiciousIPs.get(ip);
        data.isBlocked = false;
        data.blockedUntil = 0;
        data.requests = [];
        data.failedAttempts = 0;
        console.log(`[SECURITY] Unblocked IP ${ip}`);
        return true;
    }
    return false;
};

const unblockUser = (userId) => {
    if (suspiciousUsers.has(userId)) {
        const data = suspiciousUsers.get(userId);
        data.isBlocked = false;
        data.blockedUntil = 0;
        data.requests = [];
        console.log(`[SECURITY] Unblocked user ${userId}`);
        return true;
    }
    return false;
};

/**
 * Get statistics (for admin monitoring)
 */
const getSecurityStats = () => {
    const now = Date.now();
    const activeIPs = Array.from(suspiciousIPs.values()).filter(d => 
        d.requests.length > 0 && (now - d.requests[d.requests.length - 1]) < 5 * 60 * 1000
    ).length;
    
    const blockedIPs = Array.from(suspiciousIPs.values()).filter(d => 
        d.isBlocked && d.blockedUntil > now
    ).length;

    const blockedUsers = Array.from(suspiciousUsers.values()).filter(d => 
        d.isBlocked && d.blockedUntil > now
    ).length;

    return {
        activeIPs,
        blockedIPs,
        blockedUsers,
        totalTrackedIPs: suspiciousIPs.size,
        totalTrackedUsers: suspiciousUsers.size
    };
};

module.exports = {
    detectSuspiciousActivity,
    unblockIP,
    unblockUser,
    getSecurityStats
};
