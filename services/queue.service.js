/**
 * Queue Service - Sử dụng p-queue cho background job processing
 */
const PQueue = require('p-queue').default;

// Tạo các queue riêng cho từng loại file
const imageQueue = new PQueue({
    concurrency: 3,  // Xử lý tối đa 3 ảnh cùng lúc
    timeout: 30000,   // Timeout 30s mỗi job
    throwOnTimeout: true
});

const videoQueue = new PQueue({
    concurrency: 1,  // Video nặng, chỉ xử lý 1 cái một lúc
    timeout: 300000,  // Timeout 5 phút
    throwOnTimeout: true
});

const documentQueue = new PQueue({
    concurrency: 2,  // Xử lý tối đa 2 document cùng lúc
    timeout: 120000,  // Timeout 2 phút
    throwOnTimeout: true
});

// Tracking active jobs
const activeJobs = new Map(); // jobId -> { type, startTime, progress }

// Event listeners for queue monitoring
imageQueue.on('active', () => {
    console.log(`Image queue: ${imageQueue.size} waiting, ${imageQueue.pending} active`);
});

videoQueue.on('active', () => {
    console.log(`Video queue: ${videoQueue.size} waiting, ${videoQueue.pending} active`);
});

documentQueue.on('active', () => {
    console.log(`Document queue: ${documentQueue.size} waiting, ${documentQueue.pending} active`);
});

/**
 * Thêm job vào queue
 * @param {string} type - 'image' | 'video' | 'document'
 * @param {string} jobId - Unique job ID
 * @param {Function} task - Async function to execute
 * @returns {Promise}
 */
async function addJob(type, jobId, task) {
    const queue = getQueueByType(type);

    activeJobs.set(jobId, {
        type,
        startTime: Date.now(),
        progress: 0
    });

    try {
        const result = await queue.add(async () => {
            console.log(`[${jobId}] Starting ${type} processing...`);
            return await task();
        });

        activeJobs.delete(jobId);
        console.log(`[${jobId}] Completed successfully`);
        return result;
    } catch (error) {
        activeJobs.delete(jobId);
        console.error(`[${jobId}] Failed:`, error);
        throw error;
    }
}

/**
 * Cập nhật progress của job
 */
function updateProgress(jobId, progress) {
    const job = activeJobs.get(jobId);
    if (job) {
        job.progress = progress;
    }
}

/**
 * Lấy queue theo type
 */
function getQueueByType(type) {
    switch (type) {
        case 'image':
            return imageQueue;
        case 'video':
            return videoQueue;
        case 'document':
            return documentQueue;
        default:
            throw new Error(`Invalid queue type: ${type}`);
    }
}

/**
 * Lấy stats của tất cả queues
 */
function getStats() {
    return {
        image: {
            size: imageQueue.size,
            pending: imageQueue.pending
        },
        video: {
            size: videoQueue.size,
            pending: videoQueue.pending
        },
        document: {
            size: documentQueue.size,
            pending: documentQueue.pending
        },
        activeJobs: Array.from(activeJobs.entries()).map(([jobId, data]) => ({
            jobId,
            ...data,
            duration: Date.now() - data.startTime
        }))
    };
}

module.exports = {
    addJob,
    updateProgress,
    getStats,
    imageQueue,
    videoQueue,
    documentQueue
};