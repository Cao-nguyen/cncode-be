/**
 * Video Worker - Xử lý upload video với mã hóa
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const telegramClient = require('../services/telegram-client.service');
const { encryptBuffer } = require('../utils/crypto');
const { notifyProgress, notifyCompleted, notifyFailed } = require('../services/websocket-upload.service');
const { updateProgress } = require('../services/queue.service');

const unlinkAsync = promisify(fs.unlink);

/**
 * Process video upload
 */
async function processVideoUpload(params) {
    const { tempPath, fileName, mimeType, jobId, userId } = params;

    console.log(`[${jobId}] Starting video upload process...`);

    try {
        // Read file buffer
        console.log(`[${jobId}] Reading video file...`);
        const fileBuffer = fs.readFileSync(tempPath);
        const originalSize = fileBuffer.length;
        updateProgress(jobId, 10);

        // Encrypt buffer
        console.log(`[${jobId}] Encrypting video buffer...`);
        const encryptedBuffer = encryptBuffer(fileBuffer);
        updateProgress(jobId, 30);

        // Upload encrypted buffer to Telegram as file
        console.log(`[${jobId}] Uploading encrypted video to Telegram...`);
        const uploadResult = await telegramClient.uploadFile(
            encryptedBuffer,
            fileName,
            mimeType,
            'encrypted_video'
        );
        updateProgress(jobId, 80);

        if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Failed to upload to Telegram');
        }

        const { url, messageId } = uploadResult;

        console.log(`[${jobId}] Video upload successful: ${messageId}`);

        // Pre-cache decrypted video for instant playback (YouTube-style)
        console.log(`[${jobId}] Pre-caching decrypted video...`);
        const os = require('os');
        const cacheDir = path.join(os.tmpdir(), 'video_cache');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        const cachePath = path.join(cacheDir, `${jobId}_decrypted.mp4`);
        console.log(`[${jobId}] Cache path: ${cachePath}`);
        console.log(`[${jobId}] Temp path: ${tempPath}`);
        console.log(`[${jobId}] Temp path exists: ${fs.existsSync(tempPath)}`);
        try {
            fs.copyFileSync(tempPath, cachePath);
            const cacheSize = fs.statSync(cachePath).size;
            console.log(`[${jobId}] ✅ Video pre-cached for instant playback (${(cacheSize / 1024 / 1024).toFixed(1)} MB)`);
            console.log(`[${jobId}] Cache file exists: ${fs.existsSync(cachePath)}`);
        } catch (cacheError) {
            console.error(`[${jobId}] ❌ Failed to pre-cache video:`, cacheError.message);
        }

        // Clean up temp file
        try {
            await unlinkAsync(tempPath);
            console.log(`[${jobId}] Temp file cleaned up`);
        } catch (cleanupError) {
            console.warn(`[${jobId}] Failed to clean up temp file:`, cleanupError.message);
        }

        const result = {
            originalName: fileName,
            originalSize,
            mimeType,
            encrypted: true,
            messageId,
            url
        };

        notifyCompleted(jobId, result);

        return result;

    } catch (error) {
        console.error(`[${jobId}] Video upload failed:`, error);
        notifyFailed(jobId, error);

        // Clean up temp file on error
        try {
            if (tempPath && fs.existsSync(tempPath)) {
                await unlinkAsync(tempPath);
            }
        } catch (cleanupError) {
            // Ignore cleanup errors
        }

        throw error;
    }
}

/**
 * Process video from multipart form data
 */
async function processVideoFile(file, jobId, userId) {
    console.log(`[${jobId}] Processing video: ${file.originalname}`);

    return await processVideoUpload({
        tempPath: file.path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        jobId,
        userId
    });
}

module.exports = {
    processVideoUpload,
    processVideoFile
};