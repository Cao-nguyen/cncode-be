const service = require('./shortlink.service.user');

const checkAlias = async (req, res) => {
    try {
        const { alias } = req.params;
        const available = await service.isAliasAvailable(alias);
        res.json({ success: true, available });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const createShortLink = async (req, res) => {
    try {
        const { originalUrl, customAlias, expiresInDays } = req.body;
        const userId = req.userId || null;

        const shortLink = await service.createShortLink(originalUrl, userId, customAlias, expiresInDays);

        const io = req.app.get('io');
        if (io && userId) {
            io.to(userId.toString()).emit('shortlink:created', shortLink);
        }

        res.status(201).json({ success: true, data: shortLink });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const redirectToOriginal = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const result = await service.getOriginalUrl(shortCode);

        if (!result) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Link không tồn tại - CNcode</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            min-height: 100vh;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        }
                        .card {
                            background: white;
                            border-radius: 20px;
                            padding: 48px 40px;
                            text-align: center;
                            max-width: 500px;
                            margin: 20px;
                            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                        }
                        .icon { font-size: 64px; margin-bottom: 20px; }
                        h1 { font-size: 24px; color: #333; margin-bottom: 12px; }
                        p { color: #666; margin-bottom: 24px; line-height: 1.6; }
                        .btn {
                            display: inline-block;
                            padding: 12px 32px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            text-decoration: none;
                            border-radius: 40px;
                            font-weight: 500;
                            transition: transform 0.2s, box-shadow 0.2s;
                        }
                        .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="icon">🔗</div>
                        <h1>Link không tồn tại hoặc đã hết hạn</h1>
                        <p>Vui lòng kiểm tra lại đường dẫn hoặc liên hệ người gửi.</p>
                        <a href="/" class="btn">Về trang chủ</a>
                    </div>
                </body>
                </html>
            `);
        }

        res.redirect(307, result.originalUrl);
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

        const result = await service.getUserLinks(userId, page, limit);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteShortLink = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const userId = req.userId;

        await service.deleteShortLink(shortCode, userId);

        const io = req.app.get('io');
        if (io && userId) {
            io.to(userId.toString()).emit('shortlink:deleted', { shortCode });
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

        const updatedLink = await service.updateShortLink(shortCode, userId, newAlias, expiresInDays);

        const io = req.app.get('io');
        if (io && userId) {
            io.to(userId.toString()).emit('shortlink:updated', updatedLink);
        }

        res.json({ success: true, data: updatedLink });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getLinkClickStats = async (req, res) => {
    try {
        const { shortCode } = req.params;
        const userId = req.userId;
        const days = parseInt(req.query.days) || 30;
        const stats = await service.getLinkClickStats(shortCode, userId, days);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get link click stats error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    checkAlias,
    createShortLink,
    redirectToOriginal,
    getUserLinks,
    deleteShortLink,
    updateShortLink,
    getLinkClickStats,
};
