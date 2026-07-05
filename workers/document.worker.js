/**
 * Document Worker - Xử lý upload document với mã hóa
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
 * Process document upload
 */
async function processDocumentUpload(params) {
    const { tempPath, fileName, mimeType, jobId, userId } = params;

    console.log(`[${jobId}] Starting document upload process...`);

    try {
        // Read file buffer
        console.log(`[${jobId}] Reading document file...`);
        const fileBuffer = fs.readFileSync(tempPath);
        const originalSize = fileBuffer.length;
        updateProgress(jobId, 10);

        // Encrypt buffer
        console.log(`[${jobId}] Encrypting document buffer...`);
        const encryptedBuffer = encryptBuffer(fileBuffer);
        updateProgress(jobId, 30);

        // Upload encrypted buffer to Telegram as file
        console.log(`[${jobId}] Uploading encrypted document to Telegram...`);
        const uploadResult = await telegramClient.uploadFile(
            encryptedBuffer,
            fileName,
            mimeType,
            'encrypted_document'
        );
        updateProgress(jobId, 80);

        if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Failed to upload to Telegram');
        }

        const { url, messageId } = uploadResult;

        console.log(`[${jobId}] Document upload successful: ${messageId}`);

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
        console.error(`[${jobId}] Document upload failed:`, error);
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
 * Process document from multipart form data
 */
async function processDocumentFile(file, jobId, userId) {
    console.log(`[${jobId}] Processing document: ${file.originalname}`);

    return await processDocumentUpload({
        tempPath: file.path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        jobId,
        userId
    });
}

module.exports = {
    processDocumentUpload,
    processDocumentFile
};