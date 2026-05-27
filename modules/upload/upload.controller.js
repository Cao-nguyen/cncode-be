
const uploadService = require('../../services/upload.service');

class UploadController {
    async uploadImage(req, res) {
        try {
            const { image, folder = 'general' } = req.body;

            if (!image) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu dữ liệu ảnh'
                });
            }

            const result = await uploadService.uploadFromBase64(image, folder);

            if (result.success) {

                res.json({
                    success: true,
                    data: { url: result.url },
                    message: 'Upload thành công'
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: result.error
                });
            }
        } catch (error) {
            console.error('Upload image error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
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
                stats: { total: results.length, success: successCount, failed: results.length - successCount }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async uploadFile(req, res) {
        try {
            const { file, folder = 'general' } = req.body;

            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu dữ liệu file'
                });
            }

            const result = await uploadService.uploadFromBase64(file, folder, 'file');

            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        url: result.url,
                        messageId: result.messageId
                    },
                    message: 'Upload file thành công'
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: result.error
                });
            }
        } catch (error) {
            console.error('Upload file error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async uploadVideo(req, res) {
        try {
            const { video, folder = 'general' } = req.body;

            if (!video) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu dữ liệu video'
                });
            }

            const result = await uploadService.uploadFromBase64(video, folder, 'video');

            if (result.success) {
                res.json({
                    success: true,
                    data: { url: result.url },
                    message: 'Upload video thành công'
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: result.error
                });
            }
        } catch (error) {
            console.error('Upload video error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async proxyVideo(req, res) {
        try {
            const { messageId } = req.params;
            const telegramClient = require('../../services/telegram-client.service');

            // Download video qua Client API (hỗ trợ video > 20MB)
            const buffer = await telegramClient.downloadAndServeVideo(messageId);

            if (!buffer) {
                return res.status(404).json({
                    success: false,
                    message: 'Video not found'
                });
            }

            const total = buffer.length;
            const rangeHeader = req.headers.range;

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'public, max-age=3600');

            // Range request — browser seek/stream
            if (rangeHeader) {
                const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
                const start = parseInt(startStr, 10);
                const end = endStr ? parseInt(endStr, 10) : total - 1;
                const chunkSize = end - start + 1;

                res.status(206); // Partial Content
                res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
                res.setHeader('Content-Length', chunkSize);
                res.end(buffer.slice(start, end + 1));
            } else {
                // Full request
                res.setHeader('Content-Length', total);
                res.status(200).end(buffer);
            }

        } catch (error) {
            console.error('Proxy video error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async proxyFile(req, res) {
        try {
            const { messageId } = req.params;
            const telegramClient = require('../../services/telegram-client.service');

            // Download file và lấy metadata
            const result = await telegramClient.downloadFileWithMetadata(messageId);

            if (!result || !result.buffer) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found'
                });
            }

            const { buffer, filename, mimeType } = result;

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', mimeType || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Content-Length', buffer.length);
            res.status(200).end(buffer);

        } catch (error) {
            console.error('Proxy file error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new UploadController();
