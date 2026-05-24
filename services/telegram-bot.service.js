// services/telegram.service.js - Bot API
const axios = require('axios');
const FormData = require('form-data');

class TelegramService {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
        this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    }

    async uploadBase64(base64String) {
        try {
            const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches) throw new Error('Invalid base64');

            const buffer = Buffer.from(matches[2], 'base64');
            const formData = new FormData();
            formData.append('chat_id', this.chatId);
            formData.append('photo', buffer, {
                filename: `image_${Date.now()}.jpg`,
                contentType: 'image/jpeg'
            });

            const response = await axios.post(`${this.apiUrl}/sendPhoto`, formData, {
                headers: formData.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            if (response.data.ok) {
                const fileId = response.data.result.photo[response.data.result.photo.length - 1].file_id;

                // Lấy file path để tạo link tải
                const fileInfo = await axios.get(`${this.apiUrl}/getFile?file_id=${fileId}`);
                const filePath = fileInfo.data.result.file_path;

                // Link ảnh có thể embed được
                const imageUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;

                return {
                    success: true,
                    url: imageUrl,
                    fileId: fileId
                };
            }

            return { success: false, error: 'Upload failed' };
        } catch (error) {
            console.error('Telegram upload error:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new TelegramService();