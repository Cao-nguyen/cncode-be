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
const { fromPath } = require('pdf2pic');
const sharp = require('sharp');

const unlinkAsync = promisify(fs.unlink);

/**
 * Generate PDF page previews
 */
async function generatePdfPreviews(pdfPath, jobId) {
    try {
        console.log(`[${jobId}] Generating PDF previews...`);

        const options = {
            density: 100,
            saveFilename: `pdf_preview_${jobId}`,
            savePath: path.dirname(pdfPath),
            format: 'png',
            width: 800,
            height: 1132
        };

        const convert = fromPath(pdfPath, options);

        // Generate first 5 pages as previews
        const maxPages = 5;
        const previews = [];

        for (let page = 1; page <= maxPages; page++) {
            try {
                const pageResult = await convert(page, { responseType: 'buffer' });

                if (pageResult && pageResult.buffer) {
                    // Compress preview image
                    const compressed = await sharp(pageResult.buffer)
                        .jpeg({ quality: 80 })
                        .toBuffer();

                    const base64 = compressed.toString('base64');
                    previews.push({
                        page,
                        data: `data:image/jpeg;base64,${base64}`
                    });

                    console.log(`[${jobId}] Generated preview for page ${page}`);
                } else {
                    break; // No more pages
                }
            } catch (pageError) {
                console.log(`[${jobId}] Finished at page ${page - 1}`);
                break; // Reached last page
            }
        }

        console.log(`[${jobId}] Generated ${previews.length} PDF previews`);
        return previews;

    } catch (error) {
        console.error(`[${jobId}] Failed to generate PDF previews:`, error.message);
        return []; // Return empty array if preview generation fails
    }
}

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

        // Generate PDF previews if it's a PDF
        let pdfPreviews = [];
        if (mimeType === 'application/pdf') {
            try {
                pdfPreviews = await generatePdfPreviews(tempPath, jobId);
                updateProgress(jobId, 20);
            } catch (previewError) {
                console.warn(`[${jobId}] Preview generation failed:`, previewError.message);
            }
        }

        // Encrypt buffer
        console.log(`[${jobId}] Encrypting document buffer...`);
        const encryptedBuffer = encryptBuffer(fileBuffer);
        updateProgress(jobId, 40);

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
            url,
            pdfPreviews: pdfPreviews.length > 0 ? pdfPreviews : undefined
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