/**
 * Request Queue Middleware
 * Xử lý hàng đợi cho các request đồng thời để tránh quá tải server
 */

class RequestQueue {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 10; // Số request xử lý đồng thời tối đa
        this.maxQueueSize = options.maxQueueSize || 100; // Kích thước hàng đợi tối đa
        this.timeout = options.timeout || 30000; // Timeout cho mỗi request (30s)

        this.activeRequests = 0;
        this.queue = [];
        this.stats = {
            totalProcessed: 0,
            totalQueued: 0,
            totalRejected: 0,
            totalTimeout: 0
        };
    }

    /**
     * Thêm request vào hàng đợi
     */
    enqueue(req, res, next) {
        // Kiểm tra nếu hàng đợi đã đầy
        if (this.queue.length >= this.maxQueueSize) {
            this.stats.totalRejected++;
            return res.status(503).json({
                success: false,
                message: 'Server đang quá tải, vui lòng thử lại sau',
                queueSize: this.queue.length,
                activeRequests: this.activeRequests
            });
        }

        // Nếu còn slot trống, xử lý ngay
        if (this.activeRequests < this.maxConcurrent) {
            this.processRequest(req, res, next);
        } else {
            // Thêm vào hàng đợi
            this.stats.totalQueued++;
            const queueItem = {
                req,
                res,
                next,
                timestamp: Date.now(),
                timeout: setTimeout(() => {
                    this.handleTimeout(queueItem);
                }, this.timeout)
            };

            this.queue.push(queueItem);

            // Thông báo cho client về vị trí trong hàng đợi
            res.setHeader('X-Queue-Position', this.queue.length);
            res.setHeader('X-Queue-Size', this.queue.length);
            res.setHeader('X-Active-Requests', this.activeRequests);
        }
    }

    /**
     * Xử lý request
     */
    processRequest(req, res, next) {
        this.activeRequests++;
        this.stats.totalProcessed++;

        // Thêm header để client biết request đang được xử lý
        res.setHeader('X-Request-Status', 'processing');
        res.setHeader('X-Active-Requests', this.activeRequests);

        // Wrap response để track khi request hoàn thành
        const originalEnd = res.end;
        const originalSend = res.send;
        const self = this;

        const cleanup = () => {
            self.activeRequests--;
            self.processNext();
        };

        res.end = function (...args) {
            cleanup();
            originalEnd.apply(res, args);
        };

        res.send = function (...args) {
            cleanup();
            originalSend.apply(res, args);
        };

        // Xử lý lỗi
        res.on('error', cleanup);
        res.on('close', cleanup);

        next();
    }

    /**
     * Xử lý request tiếp theo trong hàng đợi
     */
    processNext() {
        if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
            const queueItem = this.queue.shift();

            // Clear timeout
            if (queueItem.timeout) {
                clearTimeout(queueItem.timeout);
            }

            // Kiểm tra nếu response đã bị đóng
            if (queueItem.res.headersSent || queueItem.res.writableEnded) {
                this.processNext();
                return;
            }

            this.processRequest(queueItem.req, queueItem.res, queueItem.next);
        }
    }

    /**
     * Xử lý timeout
     */
    handleTimeout(queueItem) {
        const index = this.queue.indexOf(queueItem);
        if (index > -1) {
            this.queue.splice(index, 1);
            this.stats.totalTimeout++;

            if (!queueItem.res.headersSent) {
                queueItem.res.status(408).json({
                    success: false,
                    message: 'Request timeout trong hàng đợi',
                    waitTime: Date.now() - queueItem.timestamp
                });
            }
        }
    }

    /**
     * Lấy thống kê
     */
    getStats() {
        return {
            ...this.stats,
            activeRequests: this.activeRequests,
            queueSize: this.queue.length,
            maxConcurrent: this.maxConcurrent,
            maxQueueSize: this.maxQueueSize
        };
    }

    /**
     * Reset thống kê
     */
    resetStats() {
        this.stats = {
            totalProcessed: 0,
            totalQueued: 0,
            totalRejected: 0,
            totalTimeout: 0
        };
    }
}

// Tạo các queue instance cho các loại request khác nhau

// Queue chung cho các API thông thường
const generalQueue = new RequestQueue({
    maxConcurrent: 50,
    maxQueueSize: 200,
    timeout: 30000
});

// Queue cho các API nặng (upload, processing)
const heavyQueue = new RequestQueue({
    maxConcurrent: 5,
    maxQueueSize: 20,
    timeout: 60000
});

// Queue cho các API nhạy cảm (auth, payment)
const criticalQueue = new RequestQueue({
    maxConcurrent: 20,
    maxQueueSize: 50,
    timeout: 15000
});

/**
 * Middleware factory để tạo queue middleware
 */
const createQueueMiddleware = (queue) => {
    return (req, res, next) => {
        queue.enqueue(req, res, next);
    };
};

/**
 * Middleware để lấy thống kê queue (chỉ dành cho admin)
 */
const queueStatsMiddleware = (req, res) => {
    const stats = {
        general: generalQueue.getStats(),
        heavy: heavyQueue.getStats(),
        critical: criticalQueue.getStats(),
        timestamp: new Date().toISOString()
    };

    res.json({
        success: true,
        data: stats
    });
};

module.exports = {
    generalQueue,
    heavyQueue,
    criticalQueue,
    createQueueMiddleware,
    queueStatsMiddleware,
    // Export các middleware sẵn
    generalQueueMiddleware: createQueueMiddleware(generalQueue),
    heavyQueueMiddleware: createQueueMiddleware(heavyQueue),
    criticalQueueMiddleware: createQueueMiddleware(criticalQueue)
};