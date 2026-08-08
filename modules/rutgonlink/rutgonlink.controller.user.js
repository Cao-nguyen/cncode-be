const {
    getShortLinkByCode,
    getUserShortLinks,
    createUserShortLink,
    updateUserShortLink,
    deleteUserShortLink
} = require('./rutgonlink.services.user');

const redirectShortLink = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const shortLink = await getShortLinkByCode(shortCode);

        // Redirect to interstitial page with shortCode and originalUrl
        const frontendUrl = process.env.FRONTEND_URL || 'https://cncode.io.vn';
        const redirectUrl = `${frontendUrl}/rutgonlink/redirect?code=${shortCode}&url=${encodeURIComponent(shortLink.originalUrl)}`;
        
        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Redirect short link error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy link rút gọn' });
    }
};

const getUserShortLinksHandler = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 20, search } = req.query;
        const result = await getUserShortLinks(userId, parseInt(page), parseInt(limit), search);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Get user short links error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const createUserShortLinkHandler = async (req, res) => {
    try {
        const userId = req.userId;
        const { originalUrl, shortCode, expiresAt } = req.body;
        const shortLink = await createUserShortLink(userId, originalUrl, shortCode, expiresAt);
        res.status(201).json({ success: true, data: shortLink, message: 'Tạo link rút gọn thành công' });
    } catch (error) {
        console.error('Create user short link error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const updateUserShortLinkHandler = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { originalUrl, shortCode, expiresAt, isActive } = req.body;
        const shortLink = await updateUserShortLink(userId, id, originalUrl, shortCode, expiresAt, isActive);
        res.json({ success: true, data: shortLink, message: 'Cập nhật link rút gọn thành công' });
    } catch (error) {
        console.error('Update user short link error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const deleteUserShortLinkHandler = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        await deleteUserShortLink(userId, id);
        res.json({ success: true, message: 'Xóa link rút gọn thành công' });
    } catch (error) {
        console.error('Delete user short link error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

module.exports = {
    redirectShortLink,
    getUserShortLinks: getUserShortLinksHandler,
    createUserShortLink: createUserShortLinkHandler,
    updateUserShortLink: updateUserShortLinkHandler,
    deleteUserShortLink: deleteUserShortLinkHandler
};
