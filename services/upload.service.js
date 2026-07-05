const telegramClient = require('./telegram-client.service.js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const MASTER_KEY = Buffer.from(process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex');

if (!process.env.ENCRYPTION_KEY) {
    console.error('⚠️ WARNING: ENCRYPTION_KEY not set in .env - using random key (files will not decrypt after restart!)');
}

class UploadService {

    /**
     * Encrypt a buffer using AES-256-CBC
     * @param {Buffer} buffer 
     * @returns {{ encrypted: Buffer, iv: string, key: string }}
     */
    _encryptBuffer(buffer) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, MASTER_KEY, iv);
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        return {
            encrypted,
            iv: iv.toString('hex'),
            key: MASTER_KEY.toString('hex'),
        };
    }

    /**
     * Decrypt a buffer using AES-256-CBC
     * @param {Buffer} encryptedBuffer 
     * @param {string} ivHex 
     * @param {string} keyHex 
     * @returns {Buffer}
     */
    _decryptBuffer(encryptedBuffer, ivHex, keyHex) {
        try {
            const iv = Buffer.from(ivHex, 'hex');
            const key = Buffer.from(keyHex, 'hex');
            const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
            return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
        } catch (error) {
            console.error('Decryption failed:', error.message);
            return null;
        }
    }

    async uploadFromBase64(base64String, folder = 'general', type = 'image', fileName = null) {
        try {
            let rawBuffer;
            let mimeType = 'image/png';

            // Check if base64String has data URL prefix
            const matches = base64String.match(/^data:([A-Za-z0-9-+\/\.]+);base64,(.+)$/);
            if (matches) {
                // Has prefix - extract mime and data
                mimeType = matches[1];
                rawBuffer = Buffer.from(matches[2], 'base64');
            } else {
                // No prefix - assume it's raw base64 data
                console.log('No data URL prefix found, treating as raw base64');
                rawBuffer = Buffer.from(base64String, 'base64');
            }

            const timestamp = Date.now();
            const { encrypted, iv, key } = this._encryptBuffer(rawBuffer);

            // Store metadata (iv + original mimeType) as JSON caption
            const caption = JSON.stringify({ iv, mime: mimeType });

            let result;
            if (type === 'file' || (!mimeType.startsWith('image/') && !mimeType.startsWith('video/'))) {
                // Determine extension from mime or fileName
                let ext = 'bin';
                if (fileName) {
                    const parts = fileName.split('.');
                    if (parts.length > 1) ext = parts[parts.length - 1];
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
                    ext = mimeToExt[mimeType] || 'bin';
                }
                const uploadFilename = fileName || `file_${timestamp}.${ext}`;
                result = await telegramClient.uploadFile(encrypted, uploadFilename, 'application/octet-stream', caption);
            } else if (mimeType.startsWith('image/')) {
                const ext = mimeType.split('/')[1] || 'png';
                result = await telegramClient.uploadImage(encrypted, `img_${timestamp}.enc.${ext}`, caption);
            } else {
                // For other types, upload as file
                const ext = mimeType.split('/')[1] || 'bin';
                result = await telegramClient.uploadFile(encrypted, `file_${timestamp}.${ext}`, 'application/octet-stream');
            }

            if (result.success) {
                return {
                    success: true,
                    url: result.url,
                    messageId: result.messageId,
                    folder,
                    caption, // Store encryption metadata
                };
            }
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async uploadMultiple(items, folder = 'general', type = 'image') {
        const results = await Promise.all(
            items.map(item => this.uploadFromBase64(item.base64, folder, type))
        );
        return results;
    }

    async uploadFile(base64String, folder = 'general', fileName = null) {
        return this.uploadFromBase64(base64String, folder, 'file', fileName);
    }

    /**
     * Decrypt a file buffer that was previously encrypted and stored on Telegram
     * @param {Buffer} encryptedBuffer 
     * @param {string} caption - JSON string containing { iv, mime }
     * @returns {{ buffer: Buffer, mimeType: string } | null}
     */
    decryptFileBuffer(encryptedBuffer, caption) {
        try {
            const meta = JSON.parse(caption);
            if (!meta.iv) {
                // No encryption metadata found, return as-is
                return { buffer: encryptedBuffer, mimeType: 'application/octet-stream' };
            }
            const decrypted = this._decryptBuffer(encryptedBuffer, meta.iv, MASTER_KEY.toString('hex'));
            if (!decrypted) return null;
            return { buffer: decrypted, mimeType: meta.mime || 'application/octet-stream' };
        } catch (error) {
            console.error('Decrypt file error:', error);
            return null;
        }
    }
}

module.exports = new UploadService();