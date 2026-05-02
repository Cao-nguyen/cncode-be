const shortlinkService = require('./shortlink.service');

const checkAlias = async (req, res) => {
    try {
        const { alias } = req.params;
        const available = await shortlinkService.isAliasAvailable(alias);
        res.json({ success: true, available });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const createShortLink = async (req, res) => {
    try {
        const { originalUrl, customAlias, expiresInDays } = req.body;
        const userId = req.userId || null;

        const shortLink = await shortlinkService.createShortLink(originalUrl, userId, customAlias, expiresInDays);

        const io = req.app.get('io');
        if (io && userId) {
            io.to(userId.toString()).emit('shortlink_created', {
                shortCode: shortLink.shortCode,
                userId
            });
        }

        res.status(201).json({ success: true, data: shortLink });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const redirectToOriginal = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const originalUrl = await shortlinkService.getOriginalUrl(shortCode);

        if (!originalUrl) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Link không tồn tại - CNcode</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body {
                            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            margin: 0;
                            background: #ffffff;
                        }
                        .container { text-align: center; padding: 2rem; }
                        .icon { font-size: 4rem; margin-bottom: 1rem; }
                        h1 { font-size: 1.5rem; color: #333; margin-bottom: 0.5rem; }
                        p { color: #666; margin-bottom: 1.5rem; }
                        a { color: #38b6ff; text-decoration: none; font-weight: 500; }
                        a:hover { text-decoration: underline; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">🔗</div>
                        <h1>Link không tồn tại hoặc đã hết hạn</h1>
                        <p>Vui lòng kiểm tra lại đường dẫn hoặc liên hệ người gửi.</p>
                        <a href="/">Về trang chủ</a>
                    </div>
                </body>
                </html>
            `);
        }

        res.redirect(307, originalUrl);
    } catch (error) {
        console.error('Redirect error:', error);
        res.status(500).send('Internal server error');
    }
};

const getUserLinks = async (req, res) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await shortlinkService.getUserLinks(userId, page, limit);
        res.json({
            success: true,
            data: {
                links: result.links,
                total: result.total,
                page: result.page,
                totalPages: result.totalPages
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAllLinks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';

        const result = await shortlinkService.getAllLinks(page, limit, search);
        res.json({
            success: true,
            data: {
                links: result.links,
                total: result.total,
                page: result.page,
                totalPages: result.totalPages
            }
        });
    } catch (error) {
        console.error('Get all links error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteShortLink = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const userId = req.userId;
        const isAdmin = req.userRole === 'admin';

        await shortlinkService.deleteShortLink(shortCode, userId, isAdmin);

        const io = req.app.get('io');
        if (io) {
            if (userId) {
                io.to(userId.toString()).emit('shortlink_deleted', { shortCode, userId });
            }
            const adminUsers = await require('../user/user.model').find({ role: 'admin' }).select('_id');
            adminUsers.forEach(admin => {
                io.to(admin._id.toString()).emit('shortlink_deleted_by_admin', { shortCode });
            });
        }

        res.json({ success: true, message: 'Xóa link thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateShortLink = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const userId = req.userId;
        const { newAlias, expiresInDays } = req.body;

        const updatedLink = await shortlinkService.updateShortLink(shortCode, userId, newAlias, expiresInDays);

        const io = req.app.get('io');
        if (io && userId) {
            io.to(userId.toString()).emit('shortlink_updated', {
                shortCode: updatedLink.shortCode,
                userId,
                oldShortCode: shortCode
            });
        }

        res.json({ success: true, data: updatedLink });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    checkAlias,
    createShortLink,
    redirectToOriginal,
    getUserLinks,
    getAllLinks,
    deleteShortLink,
    updateShortLink
};