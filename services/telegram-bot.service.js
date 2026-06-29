
const axios = require('axios');
const FormData = require('form-data');

class TelegramService {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
        this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;

        this.axiosInstance = axios.create({
            timeout: 15000, // 15s timeout - đủ cho upload ảnh
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            httpAgent: new (require('http').Agent)({
                keepAlive: true,
                maxSockets: 10
            }),
            httpsAgent: new (require('https').Agent)({
                keepAlive: true,
                maxSockets: 10
            }),
        });
    }

    async uploadBase64(base64String) {
        try {
            const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches) throw new Error('Invalid base64');

            const buffer = Buffer.from(matches[2], 'base64');

            const formData = new FormData();
            formData.append('chat_id', this.chatId);
            formData.append('photo', buffer, {
                filename: `img_${Date.now()}.jpg`,
                contentType: 'image/jpeg',
                knownLength: buffer.length
            });

            // Upload ảnh
            const response = await this.axiosInstance.post(
                `${this.apiUrl}/sendPhoto`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Connection': 'keep-alive'
                    },
                }
            );

            if (response.data.ok) {
                const photos = response.data.result.photo;
                const fileId = photos[photos.length - 1].file_id;

                const fileInfo = await this.axiosInstance.get(
                    `${this.apiUrl}/getFile`,
                    { params: { file_id: fileId } }
                );

                const filePath = fileInfo.data.result.file_path;
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
            return {
                success: false,
                error: error.response?.data?.description || error.message
            };
        }
    }
}

module.exports = new TelegramService();
