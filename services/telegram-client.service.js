const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const { CustomFile } = require('telegram/client/uploads');
const input = require('input');
const fs = require('fs');
const path = require('path');

class TelegramClientService {
    constructor() {
        this.apiId = parseInt(process.env.TELEGRAM_API_ID);
        this.apiHash = process.env.TELEGRAM_API_HASH;
        this.phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;
        this.channelId = process.env.TELEGRAM_CHANNEL_ID; // Channel username hoặc ID
        this.sessionString = process.env.TELEGRAM_SESSION || '';
        this.client = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized && this.client) {
            return;
        }

        try {
            const session = new StringSession(this.sessionString);

            this.client = new TelegramClient(session, this.apiId, this.apiHash, {
                connectionRetries: 5,
            });

            console.log('Connecting to Telegram...');
            await this.client.start({
                phoneNumber: async () => this.phoneNumber,
                password: async () => await input.text('Password (if 2FA enabled): '),
                phoneCode: async () => await input.text('Enter the code you received: '),
                onError: (err) => console.error('Telegram auth error:', err),
            });

            console.log('Connected to Telegram successfully!');

            // Lưu session string để sử dụng lần sau
            const newSession = this.client.session.save();
            if (newSession !== this.sessionString) {
                console.log('New session string:', newSession);
                console.log('Please save this to TELEGRAM_SESSION in .env file');
            }

            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize Telegram client:', error);
            throw error;
        }
    }

    async ensureConnected() {
        if (!this.initialized || !this.client) {
            await this.initialize();
        }
    }

    async uploadImage(buffer, filename = 'image.jpg') {
        try {
            await this.ensureConnected();

            const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

            // Dùng sendFile trực tiếp với buffer
            const result = await this.client.sendFile(this.channelId, {
                file: fileBuffer,
                caption: '',
                fileName: filename,
            });

            // result là Message object trực tiếp
            const messageId = result.id;

            // Trả về messageId để frontend dùng proxy endpoint
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            return {
                success: true,
                url: `${backendUrl}/api/upload/proxy/file/${messageId}`,
                messageId: messageId,
            };
        } catch (error) {
            console.error('Telegram upload image error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async uploadVideo(buffer, filename = 'video.mp4', mimeType = 'video/mp4') {
        const os = require('os');
        let tempFilePath = null;

        try {
            await this.ensureConnected();

            const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
            tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${filename}`);
            fs.writeFileSync(tempFilePath, fileBuffer);

            // Dùng sendFile thay vì uploadFile + invoke
            const result = await this.client.sendFile(this.channelId, {
                file: tempFilePath,           // path thực tế trên disk
                caption: '',
                workers: 4,                   // tăng speed
                attributes: [
                    new Api.DocumentAttributeVideo({
                        duration: 0,
                        w: 0,
                        h: 0,
                        supportsStreaming: true,  // cho phép stream
                    }),
                    new Api.DocumentAttributeFilename({
                        fileName: filename,
                    }),
                ],
            });

            // result từ sendFile là Message object trực tiếp
            const messageId = result.id;

            // Lấy file_id qua Bot API
            const axios = require('axios');
            const botToken = process.env.TELEGRAM_BOT_TOKEN;

            try {
                const forwardResponse = await axios.post(
                    `https://api.telegram.org/bot${botToken}/forwardMessage`,
                    {
                        chat_id: this.channelId,
                        from_chat_id: this.channelId,
                        message_id: messageId,
                    }
                );

                if (forwardResponse.data.ok && forwardResponse.data.result.video) {
                    const fileId = forwardResponse.data.result.video.file_id;
                    const fileResponse = await axios.get(
                        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
                    );
                    if (fileResponse.data.ok) {
                        const filePath = fileResponse.data.result.file_path;
                        return {
                            success: true,
                            url: `https://api.telegram.org/file/bot${botToken}/${filePath}`,
                            messageId,
                        };
                    }
                }
            } catch (botError) {
                console.error('Bot API error:', botError.message);
            }

            // Fallback: dùng proxy endpoint của backend
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            return {
                success: true,
                url: `${backendUrl}/api/upload/proxy/video/${messageId}`,
                messageId,
            };
        } catch (error) {
            console.error('Upload video error:', error);
            return { success: false, error: error.message };
        } finally {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }

    async uploadFile(buffer, filename, mimeType = 'application/octet-stream') {
        const os = require('os');
        let tempFilePath = null;

        try {
            await this.ensureConnected();

            const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

            // Ghi buffer ra file tạm
            tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${filename}`);
            fs.writeFileSync(tempFilePath, fileBuffer);

            // Dùng sendFile với forceDocument để upload file
            const result = await this.client.sendFile(this.channelId, {
                file: tempFilePath,           // path thực tế trên disk
                caption: '',
                fileName: filename,
                forceDocument: true,          // Bắt buộc gửi dưới dạng document
                workers: 4,
            });

            // result là Message object trực tiếp
            const messageId = result.id;

            // Trả về messageId để frontend dùng proxy endpoint
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            return {
                success: true,
                url: `${backendUrl}/api/upload/proxy/file/${messageId}`,
                messageId: messageId,
            };
        } catch (error) {
            console.error('Telegram upload file error:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            // Xóa file tạm
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }

    async downloadAndServeVideo(messageId) {
        const os = require('os');
        const cachePath = path.join(os.tmpdir(), `tg_video_cache_${messageId}.mp4`);

        // Nếu đã cache thì trả luôn
        if (fs.existsSync(cachePath)) {
            console.log(`Using cached video for message ${messageId}`);
            return fs.readFileSync(cachePath);
        }

        try {
            await this.ensureConnected();

            // Get message từ channel
            const messages = await this.client.getMessages(this.channelId, {
                ids: [parseInt(messageId)]
            });

            if (!messages || messages.length === 0 || !messages[0]) {
                return null;
            }

            const message = messages[0];

            console.log(`Downloading video for message ${messageId}...`);
            // Download video buffer qua Client API (không giới hạn 20MB)
            const buffer = await this.client.downloadMedia(message, {
                workers: 4,
            });

            // Cache lại để request sau không download lại
            fs.writeFileSync(cachePath, buffer);
            console.log(`Cached video for message ${messageId}`);

            return buffer;
        } catch (error) {
            console.error('Download video error:', error);
            return null;
        }
    }

    async downloadFileWithMetadata(messageId) {
        const os = require('os');
        const cacheDir = path.join(os.tmpdir(), 'tg_file_cache');

        // Tạo cache directory nếu chưa có
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        try {
            await this.ensureConnected();

            // Get message từ channel
            const messages = await this.client.getMessages(this.channelId, {
                ids: [parseInt(messageId)]
            });

            if (!messages || messages.length === 0 || !messages[0]) {
                return null;
            }

            const message = messages[0];

            // Lấy thông tin file từ message
            let filename = 'download';
            let mimeType = 'application/octet-stream';

            if (message.document) {
                // Tìm filename attribute
                const filenameAttr = message.document.attributes?.find(
                    attr => attr.className === 'DocumentAttributeFilename'
                );
                if (filenameAttr) {
                    filename = filenameAttr.fileName;
                }

                // Lấy mime type
                if (message.document.mimeType) {
                    mimeType = message.document.mimeType;
                }
            }

            // Check cache
            const cachePath = path.join(cacheDir, `${messageId}_${filename}`);
            if (fs.existsSync(cachePath)) {
                console.log(`Using cached file for message ${messageId}`);
                return {
                    buffer: fs.readFileSync(cachePath),
                    filename,
                    mimeType
                };
            }

            console.log(`Downloading file for message ${messageId}: ${filename}...`);

            // Download file buffer
            const buffer = await this.client.downloadMedia(message, {
                workers: 4,
            });

            // Cache file
            fs.writeFileSync(cachePath, buffer);
            console.log(`Cached file for message ${messageId}`);

            return {
                buffer,
                filename,
                mimeType
            };
        } catch (error) {
            console.error('Download file error:', error);
            return null;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.disconnect();
            this.initialized = false;
        }
    }
}

module.exports = new TelegramClientService();
