const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const input = require('input');
const fs = require('fs');
const path = require('path');

class TelegramClientService {
    constructor() {
        this.apiId = parseInt(process.env.TELEGRAM_API_ID);
        this.apiHash = process.env.TELEGRAM_API_HASH;
        this.phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;
        this.channelId = process.env.TELEGRAM_CHANNEL_ID;
        this.sessionString = process.env.TELEGRAM_SESSION || '';

        this.client = null;
        this.initialized = false;
        this.initPromise = null;
    }

    async initialize() {
        if (this.initPromise) {
            return this.initPromise;
        }

        if (this.initialized && this.client) {
            return Promise.resolve();
        }

        this.initPromise = (async () => {
            try {
                let session;
                let retryCount = 0;
                const maxRetries = 2;

                while (retryCount < maxRetries) {
                    try {
                        session = retryCount === 0
                            ? new StringSession(this.sessionString)
                            : new StringSession('');

                        this.client = new TelegramClient(session, this.apiId, this.apiHash, {
                            connectionRetries: 5,
                        });

                        console.log(`Connecting to Telegram... (attempt ${retryCount + 1}/${maxRetries})`);

                        await this.client.start({
                            phoneNumber: async () => this.phoneNumber,
                            password: async () => await input.text('Password (if 2FA enabled): '),
                            phoneCode: async () => await input.text('Enter the code you received: '),
                            onError: (err) => console.error('Telegram auth error:', err),
                        });

                        console.log('Connected to Telegram successfully!');

                        const newSession = this.client.session.save();
                        if (newSession !== this.sessionString) {
                            console.log('\n===========================================');
                            console.log('⚠️  NEW SESSION STRING GENERATED');
                            console.log('===========================================');
                            console.log('Please update TELEGRAM_SESSION in .env file with:');
                            console.log(newSession);
                            console.log('===========================================\n');
                        }

                        this.initialized = true;
                        break;
                    } catch (err) {
                        if (err.errorMessage === 'AUTH_KEY_DUPLICATED' && retryCount < maxRetries - 1) {
                            console.log('AUTH_KEY_DUPLICATED detected, retrying with new session...');
                            retryCount++;
                            if (this.client) {
                                try { await this.client.disconnect(); } catch { }
                            }
                            continue;
                        }
                        throw err;
                    }
                }
            } catch (error) {
                console.error('Failed to initialize Telegram client:', error);
                this.initPromise = null;
                this.initialized = false;
                throw error;
            }
        })();

        return this.initPromise;
    }

    async uploadImage(buffer, filename = 'image.jpg') {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            console.log(`Uploading image: ${filename}`);

            const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

            const result = await this.client.sendFile(this.channelId, {
                file: fileBuffer,
                caption: '',
                fileName: filename,
            });

            const messageId = result.id;
            const backendUrl = process.env.BACKEND_URL;
            const imageUrl = backendUrl
                ? `${backendUrl}/api/upload/proxy/file/${messageId}`
                : `/api/upload/proxy/file/${messageId}`;

            console.log(`Image uploaded successfully: ${messageId}`);

            return {
                success: true,
                url: imageUrl,
                messageId: messageId,
            };
        } catch (error) {
            console.error('Upload image error:', error);
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
            if (!this.initialized) {
                await this.initialize();
            }

            console.log(`Uploading video: ${filename}`);

            const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
            tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${filename}`);
            fs.writeFileSync(tempFilePath, fileBuffer);

            const result = await this.client.sendFile(this.channelId, {
                file: tempFilePath,
                caption: '',
                workers: 4,
                attributes: [
                    new Api.DocumentAttributeVideo({
                        duration: 0,
                        w: 0,
                        h: 0,
                        supportsStreaming: true,
                    }),
                    new Api.DocumentAttributeFilename({
                        fileName: filename,
                    }),
                ],
            });

            const messageId = result.id;

            // Try Bot API first
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
                        console.log(`Video uploaded via Bot API: ${messageId}`);
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

            // Fallback to proxy
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            console.log(`Video uploaded via proxy: ${messageId}`);
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
            if (!this.initialized) {
                await this.initialize();
            }

            console.log(`Uploading file: ${filename}`);

            const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
            tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${filename}`);
            fs.writeFileSync(tempFilePath, fileBuffer);

            const result = await this.client.sendFile(this.channelId, {
                file: tempFilePath,
                caption: '',
                fileName: filename,
                forceDocument: true,
                workers: 4,
            });

            const messageId = result.id;
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

            console.log(`File uploaded successfully: ${messageId}`);

            return {
                success: true,
                url: `${backendUrl}/api/upload/proxy/file/${messageId}`,
                messageId: messageId,
            };
        } catch (error) {
            console.error('Upload file error:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }

    async downloadAndServeVideo(messageId) {
        const os = require('os');
        const cachePath = path.join(os.tmpdir(), `tg_video_cache_${messageId}.mp4`);

        if (fs.existsSync(cachePath)) {
            console.log(`Using cached video for message ${messageId}`);
            return fs.readFileSync(cachePath);
        }

        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const messages = await this.client.getMessages(this.channelId, {
                ids: [parseInt(messageId)]
            });

            if (!messages || messages.length === 0 || !messages[0]) {
                return null;
            }

            console.log(`Downloading video for message ${messageId}...`);
            const buffer = await this.client.downloadMedia(messages[0], {
                workers: 4,
            });

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

        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const messages = await this.client.getMessages(this.channelId, {
                ids: [parseInt(messageId)]
            });

            if (!messages || messages.length === 0 || !messages[0]) {
                return null;
            }

            const message = messages[0];
            let filename = 'download';
            let mimeType = 'application/octet-stream';

            if (message.document) {
                const filenameAttr = message.document.attributes?.find(
                    attr => attr.className === 'DocumentAttributeFilename'
                );
                if (filenameAttr) {
                    filename = filenameAttr.fileName;
                }
                if (message.document.mimeType) {
                    mimeType = message.document.mimeType;
                }
            }

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
            const buffer = await this.client.downloadMedia(message, {
                workers: 4,
            });

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
            try {
                await this.client.disconnect();
                console.log('Disconnected from Telegram');
                this.initialized = false;
            } catch (error) {
                console.error('Disconnect error:', error);
            }
        }
    }
}

module.exports = new TelegramClientService();