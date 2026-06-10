const telegramClient = require('./telegram-client.service.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

class UploadService {

    async uploadFromBase64(base64String, folder = 'general', type = 'image') {
        try {
            const matches = base64String.match(/^data:([A-Za-z0-9-+\/\.]+);base64,(.+)$/);
            if (!matches) {
                console.error('Invalid base64 format:', base64String.substring(0, 100));
                return { success: false, error: 'Invalid base64 format' };
            }

            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const timestamp = Date.now();

            let result;
            if (type === 'image' || mimeType.startsWith('image/')) {
                const ext = mimeType.split('/')[1] || 'jpg';
                result = await telegramClient.uploadImage(buffer, `img_${timestamp}.${ext}`);
            } else {
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
                const ext = mimeToExt[mimeType] || mimeType.split('/')[1]?.split('.').pop() || 'bin';
                result = await telegramClient.uploadFile(buffer, `file_${timestamp}.${ext}`, mimeType);
            }

            if (result.success) {
                return { success: true, url: result.url, messageId: result.messageId, folder };
            }
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }


    // [FIX] Upload parallel thay vì tuần tự
    async uploadMultiple(items, folder = 'general', type = 'image') {
        const results = await Promise.all(
            items.map(item => this.uploadFromBase64(item.base64, folder, type))
        );
        return results;
    }


    async uploadFile(base64String, folder = 'general') {
        return this.uploadFromBase64(base64String, folder, 'file');
    }
}

module.exports = new UploadService();