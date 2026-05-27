const telegramClient =
    require('./telegram-client.service.js');

class UploadService {

    async uploadFromBase64(
        base64String,
        folder = 'general',
        type = 'image'
    ) {

        try {
            // Parse base64 string
            const matches = base64String.match(/^data:([A-Za-z0-9-+\/\.]+);base64,(.+)$/);
            if (!matches) {
                console.error('Invalid base64 format. String starts with:', base64String.substring(0, 100));
                return {
                    success: false,
                    error: 'Invalid base64 format',
                };
            }

            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');

            // Determine file type and extension
            let result;
            const timestamp = Date.now();

            if (type === 'image' || mimeType.startsWith('image/')) {
                const ext = mimeType.split('/')[1] || 'jpg';
                result = await telegramClient.uploadImage(
                    buffer,
                    `img_${timestamp}.${ext}`
                );
            } else if (type === 'video' || mimeType.startsWith('video/')) {
                const ext = mimeType.split('/')[1] || 'mp4';
                result = await telegramClient.uploadVideo(
                    buffer,
                    `video_${timestamp}.${ext}`,
                    mimeType
                );
            } else {
                // Generic file upload - detect proper extension and mime type
                let ext = 'bin';
                let properMimeType = mimeType;

                // Map MIME types to proper extensions
                const mimeToExt = {
                    'application/pdf': 'pdf',
                    'application/msword': 'doc',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                    'application/vnd.ms-excel': 'xls',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
                    'application/vnd.ms-powerpoint': 'ppt',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
                    'application/zip': 'zip',
                    'application/x-zip-compressed': 'zip',
                    'application/x-rar-compressed': 'rar',
                    'application/vnd.rar': 'rar',
                };

                if (mimeToExt[mimeType]) {
                    ext = mimeToExt[mimeType];
                } else {
                    // Fallback: try to extract from mime type
                    ext = mimeType.split('/')[1]?.split('.').pop() || 'bin';
                }

                result = await telegramClient.uploadFile(
                    buffer,
                    `file_${timestamp}.${ext}`,
                    properMimeType
                );
            }

            if (result.success) {
                return {
                    success: true,
                    url: result.url,
                    messageId: result.messageId,
                    folder,
                };
            }

            return {
                success: false,
                error: result.error,
            };

        } catch (error) {

            return {
                success: false,
                error: error.message,
            };
        }
    }

    async uploadMultiple(
        items,
        folder = 'general',
        type = 'image'
    ) {
        // Upload theo batch để tránh quá tải
        const BATCH_SIZE = 5; // Upload tối đa 5 files cùng lúc
        const results = [];

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(item =>
                this.uploadFromBase64(item.base64, folder, type)
            );
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        return results;
    }

    async uploadVideo(base64String, folder = 'general') {
        return this.uploadFromBase64(base64String, folder, 'video');
    }

    async uploadFile(base64String, folder = 'general') {
        return this.uploadFromBase64(base64String, folder, 'file');
    }
}

module.exports =
    new UploadService();
