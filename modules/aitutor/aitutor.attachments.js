const telegramClient = require('../../services/telegram-client.service');
const uploadService = require('../../services/upload.service');

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_ONLY_PROMPT = 'Tìm kiếm nội dung về bức ảnh này';

function normalizeImageAttachment(attachment) {
    if (!attachment?.name || attachment.type !== 'image') {
        return null;
    }

    const messageId = attachment.messageId ? String(attachment.messageId) : '';
    const dataUrl = typeof attachment.dataUrl === 'string' ? attachment.dataUrl.trim() : '';

    if (!messageId && !dataUrl.startsWith('data:image/')) {
        return null;
    }

    return {
        type: 'image',
        name: attachment.name,
        url: attachment.url || '',
        messageId,
        dataUrl,
    };
}

function sanitizeAttachmentsForStorage(attachments = []) {
    return attachments
        .map(normalizeImageAttachment)
        .filter(Boolean)
        .map(({ type, name, url, messageId }) => ({
            type,
            name,
            url,
            messageId,
        }));
}

async function resolveImageDataUrl(attachment) {
    const normalized = normalizeImageAttachment(attachment);
    if (!normalized) return null;

    if (normalized.dataUrl.startsWith('data:image/')) {
        return normalized.dataUrl;
    }

    if (!normalized.messageId) return null;

    const fileData = await telegramClient.downloadFileWithMetadata(normalized.messageId);
    if (!fileData?.buffer) return null;

    let buffer = fileData.buffer;
    let mimeType = fileData.mimeType || 'image/jpeg';

    if (fileData.caption?.trim()) {
        const decrypted = uploadService.decryptFileBuffer(buffer, fileData.caption);
        if (decrypted) {
            buffer = decrypted.buffer;
            mimeType = decrypted.mimeType || mimeType;
        }
    }

    if (!mimeType.startsWith('image/')) {
        mimeType = 'image/jpeg';
    }

    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function pushImagePart(imageParts, dataUrl, name) {
    const base64Body = dataUrl.split(',')[1] || '';
    const approxBytes = Math.ceil(base64Body.length * 0.75);
    if (approxBytes > MAX_IMAGE_BYTES) {
        throw new Error(`Ảnh "${name}" quá lớn. Vui lòng chọn ảnh nhỏ hơn 4MB.`);
    }

    imageParts.push({
        type: 'image_url',
        image_url: { url: dataUrl },
    });
}

async function buildImageParts(attachments = []) {
    const imageParts = [];

    for (const attachment of attachments) {
        const normalized = normalizeImageAttachment(attachment);
        if (!normalized) continue;

        const dataUrl = await resolveImageDataUrl(normalized);
        if (!dataUrl?.startsWith('data:image/')) continue;

        pushImagePart(imageParts, dataUrl, normalized.name);
    }

    return imageParts;
}

function buildUserDisplayContent(message, attachments = []) {
    const trimmed = typeof message === 'string' ? message.trim() : '';
    if (trimmed) return trimmed;

    const hasImage = attachments.some((item) => item?.type === 'image');
    if (hasImage) return IMAGE_ONLY_PROMPT;

    return trimmed;
}

module.exports = {
    IMAGE_ONLY_PROMPT,
    normalizeImageAttachment,
    sanitizeAttachmentsForStorage,
    buildImageParts,
    buildUserDisplayContent,
};
