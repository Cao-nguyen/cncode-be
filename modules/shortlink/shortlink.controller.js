const shortlinkService = require('./shortlink.service');

async function createShortLink(req, res) {
    try {
        const { originalUrl, customAlias, expiresInDays } = req.body;

        if (!originalUrl) {
            console.log('❌ Thiếu originalUrl');
            return res.status(400).json({ error: 'Vui lòng nhập URL' });
        }

        console.log('📝 Gọi service...');
        const result = await shortlinkService.createShortLink(
            originalUrl,
            req.user?.id || null,
            customAlias || null,
            expiresInDays || null
        );

        console.log('✅ Tạo link thành công:', result);
        console.log('📤 Đang gửi response về FE...');

        res.status(201).json({ success: true, data: result });

        console.log('✅ Đã gửi response xong');
    } catch (error) {
        console.log('❌ LỖI:', error.message);
        console.log('❌ Stack:', error.stack);
        res.status(400).json({ error: error.message });
    }
}

async function checkAlias(req, res) {
    try {
        const { alias } = req.params;
        if (!alias?.trim()) {
            return res.status(400).json({ error: 'Alias không hợp lệ' });
        }
        const available = await shortlinkService.isAliasAvailable(alias.trim());
        res.json({ alias: alias.trim(), available });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getUserLinks(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const result = await shortlinkService.getUserLinks(req.userId, page, limit);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getAllLinks(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const search = req.query.search?.trim() || '';
        const result = await shortlinkService.getAllLinks(page, limit, search);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function deleteShortLink(req, res) {
    try {
        const { shortCode } = req.params;
        const isAdmin = ['admin', 'leader'].includes(req.userRole);
        await shortlinkService.deleteShortLink(shortCode, req.userId, isAdmin);
        res.json({ success: true, message: 'Đã xóa link thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

async function updateShortLink(req, res) {
    try {
        const { shortCode } = req.params;
        const { newAlias, expiresInDays } = req.body;
        const updated = await shortlinkService.updateShortLink(
            shortCode,
            req.userId,
            newAlias?.trim() || null,
            expiresInDays !== undefined ? Number(expiresInDays) : undefined
        );
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

async function redirectToOriginal(req, res) {
    try {
        const { shortCode } = req.params;
        console.log('🔄 [Redirect] shortCode:', shortCode);

        const originalUrl = await shortlinkService.getOriginalUrl(shortCode);

        if (!originalUrl) {
            console.log('❌ [Redirect] Link not found:', shortCode);
            return res.status(404).json({
                success: false,
                error: 'Link không tồn tại hoặc đã hết hạn'
            });
        }

        console.log('✅ [Redirect] Found:', originalUrl);

        // Trả về JSON cho FE để FE tự redirect
        res.json({
            success: true,
            originalUrl: originalUrl
        });
    } catch (error) {
        console.error('❌ [Redirect] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi máy chủ'
        });
    }
}

module.exports = {
    createShortLink,
    checkAlias,
    getUserLinks,
    getAllLinks,
    deleteShortLink,
    updateShortLink,
    redirectToOriginal,
};