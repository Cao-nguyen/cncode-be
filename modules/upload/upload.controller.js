// modules/upload/upload.controller.js
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
                // ✅ Đảm bảo response có cấu trúc { success: true, data: { url } }
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
}

module.exports = new UploadController();