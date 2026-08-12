const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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

function buildImageParts(attachments = []) {
    const imageParts = [];

    for (const attachment of attachments) {
        const normalized = normalizeImageAttachment(attachment);
        if (!normalized) continue;

        if (!normalized.dataUrl.startsWith('data:image/')) {
            continue;
        }

        // Groq giới hạn payload — cắt base64 nếu quá lớn (~3MB raw)
        const base64Body = normalized.dataUrl.split(',')[1] || '';
        const approxBytes = Math.ceil(base64Body.length * 0.75);
        if (approxBytes > MAX_IMAGE_BYTES) {
            throw new Error(`Ảnh "${normalized.name}" quá lớn. Vui lòng chọn ảnh nhỏ hơn 4MB.`);
        }

        imageParts.push({
            type: 'image_url',
            image_url: { url: normalized.dataUrl },
        });
    }

    return imageParts;
}

function buildUserDisplayContent(message, attachments = []) {
    return message.trim();
}

module.exports = {
    normalizeImageAttachment,
    sanitizeAttachmentsForStorage,
    buildImageParts,
    buildUserDisplayContent,
};
