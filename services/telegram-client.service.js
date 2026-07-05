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

    async uploadImage(buffer, filename = 'image.jpg', caption = '') {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            console.log(`Uploading image: ${filename}`);

            const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

            const result = await this.client.sendFile(this.channelId, {
                file: fileBuffer,
                caption: caption,
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

    async _preCacheVideo(messageId, originalFilePath = null) {
        const os = require('os');
        const cacheDir = path.join(os.tmpdir(), 'tg_video_cache');
        const cachePath = path.join(cacheDir, `${messageId}.mp4`);

        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        // Nếu file gốc vẫn còn → copy thẳng vào cache, không cần download lại
        if (originalFilePath && fs.existsSync(originalFilePath)) {
            fs.copyFileSync(originalFilePath, cachePath);
            console.log(`Pre-cached from original file: message ${messageId}`);
            return;
        }

        // Nếu không còn file gốc → download từ Telegram
        if (fs.existsSync(cachePath)) return; // đã có cache rồi

        console.log(`Pre-caching video from Telegram: message ${messageId}...`);

        const messages = await this.client.getMessages(this.channelId, {
            ids: [parseInt(messageId)]
        });

        if (!messages?.[0]?.media) return;

        const buffer = await this.client.downloadMedia(messages[0], { workers: 4 });
        fs.writeFileSync(cachePath, buffer);
        console.log(`Pre-cache done: message ${messageId} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
    }

    async uploadVideoFromPath(filePath, filename = 'video.mp4', mimeType = 'video/mp4', progressCallback = null) {
        try {
            if (!this.initialized) await this.initialize();

            console.log(`Uploading video from path: ${filename}`);
            const stats = fs.statSync(filePath);
            const totalSize = stats.size;
            let lastEmitted = -1;

            const result = await this.client.sendFile(this.channelId, {
                file: filePath,
                caption: '',
                workers: 4,
                progressCallback: progressCallback
                    ? (received, total) => {
                        const pct = Math.round((received / (total || totalSize)) * 100);
                        // Throttle to avoid spamming socket
                        if (pct !== lastEmitted) {
                            lastEmitted = pct;
                            progressCallback(pct);
                        }
                    }
                    : undefined,
                attributes: [
                    new Api.DocumentAttributeVideo({
                        duration: 0, w: 0, h: 0, supportsStreaming: true,
                    }),
                    new Api.DocumentAttributeFilename({ fileName: filename }),
                ],
            });

            const messageId = result.id;
            const axios = require('axios');
            const botToken = process.env.TELEGRAM_BOT_TOKEN;

            try {
                const forwardResponse = await axios.post(
                    `https://api.telegram.org/bot${botToken}/forwardMessage`,
                    { chat_id: this.channelId, from_chat_id: this.channelId, message_id: messageId }
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

            const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            console.log(`Video uploaded via proxy: ${messageId}`);
            return {
                success: true,
                url: `${backendUrl}/api/upload/proxy/video/${messageId}`,
                messageId,
            };
        } catch (error) {
            console.error('Upload video from path error:', error);
            return { success: false, error: error.message };
        } finally {
            // File cleanup handled by upload.service.js
            // Don't delete here - let the service manage lifecycle
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    }

    async uploadFile(buffer, filename, mimeType = 'application/octet-stream', caption = '') {
        const os = require('os');
        let tempFilePath = null;

        try {
            if (!this.initialized) {
                await this.initialize();
            }

            console.log(`Uploading file: ${filename}`);

            const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

            // Sanitize filename for temp file path (avoid encoding issues)
            const sanitizedTempName = `upload_${Date.now()}_${Buffer.from(filename).toString('base64').substring(0, 20)}.tmp`;
            tempFilePath = path.join(os.tmpdir(), sanitizedTempName);
            fs.writeFileSync(tempFilePath, fileBuffer);

            const result = await this.client.sendFile(this.channelId, {
                file: tempFilePath,
                caption: caption,
                fileName: Buffer.from(filename, 'utf8').toString('utf8'), // Ensure UTF-8 encoding
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
        const cacheDir = path.join(os.tmpdir(), 'tg_video_cache');

        // Resolve temp → real
        if (String(messageId).startsWith('temp_')) {
            const metaPath = path.join(cacheDir, `${messageId}.meta.json`);
            if (fs.existsSync(metaPath)) {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                if (meta.done && meta.realMessageId) {
                    messageId = String(meta.realMessageId);
                }
            }
        }

        const cachePath = path.join(cacheDir, `${messageId}.mp4`);

        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

        // Cache miss → download từ Telegram
        if (!fs.existsSync(cachePath)) {
            if (String(messageId).startsWith('temp_')) {
                // temp nhưng chưa có cache file → upload chưa xong
                console.warn(`Temp cache missing for ${messageId}`);
                return null;
            }

            console.log(`Cache miss — downloading full video ${messageId}...`);
            if (!this.initialized) await this.initialize();

            const messages = await this.client.getMessages(this.channelId, {
                ids: [parseInt(messageId)]
            });

            if (!messages?.[0]?.media) return null;

            const buffer = await this.client.downloadMedia(messages[0], { workers: 4 });
            fs.writeFileSync(cachePath, buffer);
            console.log(`Cached: ${messageId} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
        }

        const fileSize = fs.statSync(cachePath).size;
        return { cachePath, fileSize };
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
            let caption = message.message || '';

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
            } else if (message.photo) {
                mimeType = 'image/jpeg';
                filename = `photo_${messageId}.jpg`;
            } else {
                console.error(`Message ${messageId} has no document or photo`);
                return null;
            }

            const cachePath = path.join(cacheDir, `${messageId}_${filename}`);
            if (fs.existsSync(cachePath)) {
                console.log(`Using cached file for message ${messageId}`);
                return {
                    buffer: fs.readFileSync(cachePath),
                    filename,
                    mimeType,
                    caption
                };
            }

            console.log(`Downloading file for message ${messageId}: ${filename}...`);
            const buffer = await this.client.downloadMedia(message, {
                workers: 4,
            });

            if (!buffer) {
                console.error(`Download returned empty buffer for message ${messageId}`);
                return null;
            }

            fs.writeFileSync(cachePath, buffer);
            console.log(`Cached file for message ${messageId}`);

            return {
                buffer,
                filename,
                mimeType,
                caption
            };
        } catch (error) {
            console.error('Download file error:', error.message);
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