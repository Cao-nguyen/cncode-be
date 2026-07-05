/**
 * Image Worker - Xử lý upload ảnh với mã hóa AES-256-CBC
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
 * Tạo blur placeholder từ buffer
 * @param {Buffer} buffer - Image buffer
 * @returns {string} - Base64 blurred placeholder
 */
function createBlurPlaceholder(buffer) {
    return new Promise((resolve, reject) => {
        const canvas = require('canvas');
        const { createCanvas, loadImage } = canvas;

        loadImage(buffer).then(img => {
            // Scale down for placeholder (32x32)
            const width = 32;
            const height = Math.round((img.height / img.width) * width);

            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Blur effect - draw image with low quality
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, width, height);

            // Get base64 data URL
            const placeholder = canvas.toDataURL('image/jpeg', 0.5);
            resolve(placeholder);
        }).catch(reject);
    });
}

/**
 * Process image upload
 * @param {object} params - Upload parameters
 * @param {string} params.tempPath - Path to temp file
 * @param {string} params.fileName - Original file name
 * @param {string} params.mimeType - MIME type
 * @param {string} params.jobId - Unique job ID
 * @param {string} params.userId - User ID
 * @returns {Promise<object>} - Upload result
 */
async function processImageUpload(params) {
    const { tempPath, fileName, mimeType, jobId, userId } = params;

    console.log(`[${jobId}] Starting image upload process...`);

    try {
        // Read file buffer
        console.log(`[${jobId}] Reading file...`);
        const fileBuffer = fs.readFileSync(tempPath);
        const originalSize = fileBuffer.length;
        updateProgress(jobId, 10);

        // Create blur placeholder
        console.log(`[${jobId}] Creating blur placeholder...`);
        const placeholder = await createBlurPlaceholder(fileBuffer);
        updateProgress(jobId, 20);

        // Encrypt buffer
        console.log(`[${jobId}] Encrypting buffer...`);
        const encryptedBuffer = encryptBuffer(fileBuffer);
        updateProgress(jobId, 30);

        // Upload encrypted buffer to Telegram
        console.log(`[${jobId}] Uploading encrypted image to Telegram...`);
        const uploadResult = await telegramClient.uploadImage(
            encryptedBuffer,
            fileName,
            `encrypted_${Date.now()}`
        );
        updateProgress(jobId, 80);

        if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Failed to upload to Telegram');
        }

        const { url, messageId } = uploadResult;

        console.log(`[${jobId}] Upload successful: ${messageId}`);

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
            url,
            placeholder
        };

        // Notify completed
        notifyCompleted(jobId, result);

        return result;

    } catch (error) {
        console.error(`[${jobId}] Image upload failed:`, error);

        // Notify failed
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
 * Process image from multipart form data
 * @param {object} file - Multer file object
 * @param {string} jobId - Unique job ID
 * @param {string} userId - User ID
 * @returns {Promise<object>}
 */
async function processImageFile(file, jobId, userId) {
    console.log(`[${jobId}] Processing image: ${file.originalname}`);

    return await processImageUpload({
        tempPath: file.path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        jobId,
        userId
    });
}

module.exports = {
    processImageUpload,
    processImageFile
};