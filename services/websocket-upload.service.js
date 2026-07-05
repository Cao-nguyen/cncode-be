/**
 * WebSocket Service cho Upload Progress
 * Notify real-time cho upload jobs
 */
const WebSocket = require('ws');

let wss = null;
const clients = new Map(); // jobId → Set<WebSocket>

/**
 * Khởi tạo WebSocket server
 * @param {http.Server} server - HTTP server instance
 */
function init(server) {
    if (wss) {
        console.log('WebSocket upload service already initialized');
        return wss;
    }

    wss = new WebSocket.Server({
        server,
        path: '/ws/upload'
    });

    wss.on('connection', (ws, req) => {
        console.log('WebSocket upload client connected:', req.socket.remoteAddress);

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());

                if (data.type === 'subscribe' && data.jobId) {
                    // Client subscribe để nhận updates của job
                    if (!clients.has(data.jobId)) {
                        clients.set(data.jobId, new Set());
                    }
                    clients.get(data.jobId).add(ws);

                    console.log(`Client subscribed to job: ${data.jobId}`);

                    // Send acknowledgment
                    ws.send(JSON.stringify({
                        type: 'subscribed',
                        jobId: data.jobId
                    }));
                }

                if (data.type === 'unsubscribe' && data.jobId) {
                    const jobClients = clients.get(data.jobId);
                    if (jobClients) {
                        jobClients.delete(ws);
                        if (jobClients.size === 0) {
                            clients.delete(data.jobId);
                        }
                    }
                    console.log(`Client unsubscribed from job: ${data.jobId}`);
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        });

        ws.on('close', () => {
            // Remove client từ tất cả subscriptions
            clients.forEach((jobClients, jobId) => {
                jobClients.delete(ws);
                if (jobClients.size === 0) {
                    clients.delete(jobId);
                }
            });
            console.log('WebSocket upload client disconnected');
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

        // Send ping để keep-alive
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            } else {
                clearInterval(pingInterval);
            }
        }, 30000);
    });

    console.log('WebSocket upload service initialized on path: /ws/upload');
    return wss;
}

/**
 * Notify progress cho một job
 * @param {string} jobId - Job ID
 * @param {object} data - Progress data
 */
function notifyProgress(jobId, data) {
    const jobClients = clients.get(jobId);
    if (!jobClients || jobClients.size === 0) {
        return;
    }

    const message = JSON.stringify({
        type: 'progress',
        jobId,
        ...data
    });

    jobClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(message);
            } catch (error) {
                console.error(`Failed to send to client:`, error);
            }
        }
    });

    console.log(`Notified ${jobClients.size} clients for job ${jobId}:`, data.status || 'progress');
}

/**
 * Notify job completed
 */
function notifyCompleted(jobId, result) {
    notifyProgress(jobId, {
        status: 'completed',
        progress: 100,
        ...result
    });

    // Cleanup clients sau 5s
    setTimeout(() => {
        clients.delete(jobId);
    }, 5000);
}

/**
 * Notify job failed
 */
function notifyFailed(jobId, error) {
    notifyProgress(jobId, {
        status: 'failed',
        error: error.message || 'Unknown error'
    });

    // Cleanup clients sau 5s
    setTimeout(() => {
        clients.delete(jobId);
    }, 5000);
}

/**
 * Get connection stats
 */
function getStats() {
    return {
        totalClients: wss ? wss.clients.size : 0,
        subscribedJobs: clients.size,
        jobs: Array.from(clients.entries()).map(([jobId, jobClients]) => ({
            jobId,
            clients: jobClients.size
        }))
    };
}

/**
 * Close WebSocket server
 */
function close() {
    if (wss) {
        wss.close();
        clients.clear();
        wss = null;
        console.log('WebSocket upload service closed');
    }
}

module.exports = {
    init,
    notifyProgress,
    notifyCompleted,
    notifyFailed,
    getStats,
    close
};