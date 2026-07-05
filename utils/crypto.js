/**
 * Mã hóa/Giải mã file với AES-256-CBC
 */
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes hex string (64 characters)
const IV_LENGTH = 16;

/**
 * Mã hóa buffer
 * @param {Buffer} buffer - Buffer cần mã hóa
 * @returns {Buffer} - Buffer đã mã hóa (IV + encrypted data)
 */
function encryptBuffer(buffer) {
    if (!ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY not set in environment');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(ENCRYPTION_KEY, 'hex'),
        iv
    );

    const encrypted = Buffer.concat([
        cipher.update(buffer),
        cipher.final()
    ]);

    // Prepend IV vào đầu để lưu cùng
    return Buffer.concat([iv, encrypted]);
}

/**
 * Giải mã buffer
 * @param {Buffer} encryptedBuffer - Buffer đã mã hóa (IV + encrypted data)
 * @returns {Buffer} - Buffer gốc
 */
function decryptBuffer(encryptedBuffer) {
    if (!ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY not set in environment');
    }

    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const encrypted = encryptedBuffer.slice(IV_LENGTH);

    const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(ENCRYPTION_KEY, 'hex'),
        iv
    );

    return Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);
}

/**
 * Tạo encryption key mới (32 bytes = 64 hex characters)
 * @returns {string}
 */
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    encryptBuffer,
    decryptBuffer,
    generateEncryptionKey
};