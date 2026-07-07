const uploadService = require('../../services/upload.service');
const fs = require('fs');
const path = require('path');
const os = require('os');

class UploadController {
    async uploadImage(req, res) {
        try {
            const { image, folder = 'general' } = req.body;
            if (!image) {
                return res.status(400).json({ success: false, message: 'Thiếu dữ liệu ảnh' });
            }

            const result = await uploadService.uploadFromBase64(image, folder);
            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        url: result.url,
                        messageId: result.messageId
                    },
                    message: 'Upload thành công'
                });
            } else {
                res.status(500).json({ success: false, message: result.error });
            }
        } catch (error) {
            console.error('Upload image error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async uploadMultiple(req, res) {
        try {
            const { images, folder = 'general' } = req.body;
            if (!images || !Array.isArray(images)) {
                return res.status(400).json({ success: false, message: 'Thiếu dữ liệu' });
            }

            const results = await uploadService.uploadMultiple(images, folder);
            const successCount = results.filter(r => r.success).length;

            res.json({
                success: true,
                data: results,
                stats: { total: results.length, success: successCount, failed: results.length - successCount },
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async uploadFile(req, res) {
        try {
            const { file, fileName, folder = 'general' } = req.body;
            if (!file) {
                return res.status(400).json({ success: false, message: 'Thiếu dữ liệu file' });
            }

            const result = await uploadService.uploadFile(file, folder, fileName || null);
            if (result.success) {
                res.json({
                    success: true,
                    data: { url: result.url, messageId: result.messageId },
                    message: 'Upload file thành công',
                });
            } else {
                res.status(500).json({ success: false, message: result.error });
            }
        } catch (error) {
            console.error('Upload file error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async proxyFile(req, res) {
        try {
            const { messageId } = req.params;
            const telegramClient = require('../../services/telegram-client.service');

            console.log(`[proxyFile] Request for messageId: ${messageId}`);

            const result = await telegramClient.downloadFileWithMetadata(messageId);
            if (!result?.buffer) {
                console.error(`[proxyFile] ❌ File not found in Telegram for messageId: ${messageId}`);
                // Return transparent 1x1 pixel instead of JSON for img tags
                const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Cache-Control', 'no-cache');
                return res.status(200).send(transparentPixel);
            }

            let { buffer, filename, mimeType, caption } = result;

            console.log(`[proxyFile] ✅ Downloaded: filename=${filename}, mimeType=${mimeType}, size=${buffer.length}, hasCaption=${!!caption}`);

            // Try to decrypt if we have caption metadata
            if (caption && caption.trim()) {
                try {
                    console.log(`[proxyFile] 🔓 Attempting decryption...`);
                    const decrypted = uploadService.decryptFileBuffer(buffer, caption);
                    if (decrypted) {
                        buffer = decrypted.buffer;
                        mimeType = decrypted.mimeType || mimeType;
                        console.log(`[proxyFile] ✅ Decrypted successfully: mimeType=${mimeType}, size=${buffer.length}`);
                    } else {
                        console.log(`[proxyFile] ⚠️ Decryption returned null, using raw buffer (old unencrypted file)`);
                    }
                } catch (decryptErr) {
                    console.error(`[proxyFile] ❌ Decrypt error: ${decryptErr.message}, using raw buffer`);
                }
            } else {
                console.log(`[proxyFile] ℹ️ No caption metadata, treating as raw unencrypted file`);
            }

            // Prepend "CNcode - " to filename for branding
            const ext = filename.includes('.') ? filename.split('.').pop() : '';
            const baseName = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
            const brandedFilename = `CNcode - ${baseName}.${ext}`;

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', mimeType || 'application/octet-stream');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Accept-Ranges', 'bytes'); // Enable range requests for streaming

            const isImage = mimeType?.startsWith('image/');
            const isVideo = mimeType?.startsWith('video/');
            if (!isImage && !isVideo) {
                res.setHeader('Content-Disposition', `attachment; filename="${brandedFilename}"`);
            } else {
                res.setHeader('Content-Disposition', `inline; filename="${brandedFilename}"`);
            }

            // Handle Range Request for chunked streaming (critical for videos!)
            const range = req.headers.range;
            const fileSize = buffer.length;
            
            if (range) {
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                
                // Validate range
                if (start >= fileSize || end >= fileSize) {
                    res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
                    return;
                }
                
                const chunkSize = end - start + 1;
                res.status(206); // Partial Content
                res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
                res.setHeader('Content-Length', chunkSize);
                
                const chunk = buffer.slice(start, end + 1);
                res.end(chunk);
            } else {
                // No range request: send entire file
                res.setHeader('Content-Length', fileSize);
                res.status(200).end(buffer);
            }
        } catch (error) {
            console.error('[proxyFile] Error:', error);
            // Return transparent pixel instead of JSON for img tags
            const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-cache');
            res.status(200).send(transparentPixel);
        }
    }

}

module.exports = new UploadController();