const ShortLink = require('./shortlink.model');
const shortlinkService = require('./shortlink.service');

const createShortLink = async (req, res) => {
    try {
        const { url, customSlug, expiresInDays } = req.body;
        const userId = req.userId || null;

        if (!url) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập URL' });
        }

        const shortLink = await shortlinkService.createShortLink(url, customSlug, userId, expiresInDays);

        res.json({
            success: true,
            data: {
                shortCode: shortLink.slug,
                originalUrl: shortLink.originalUrl,
                expiresAt: shortLink.expiresAt
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const redirectToOriginal = async (req, res) => {
    try {
        const { slug } = req.params;
        const originalUrl = await shortlinkService.getOriginalUrl(slug);
        res.redirect(302, originalUrl);
    } catch (error) {
        res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Link không tồn tại</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #ff4444; margin-bottom: 16px; }
          p { color: #666; margin-bottom: 24px; }
          a { color: #0066cc; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔗 Link không tồn tại</h1>
          <p>${error.message}</p>
          <a href="/">← Về trang chủ</a>
        </div>
      </body>
      </html>
    `);
    }
};

const getUserLinks = async (req, res) => {
    try {
        const userId = req.userId;
        const links = await shortlinkService.getUserLinks(userId);
        res.json({ success: true, data: links });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteLink = async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.userId;
        await shortlinkService.deleteLink(slug, userId);
        res.json({ success: true, message: 'Xóa link thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const checkSlug = async (req, res) => {
    try {
        const { slug } = req.params;

        if (!slug || slug.length < 3) {
            return res.json({ available: false, message: 'Slug phải có ít nhất 3 ký tự' });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
            return res.json({ available: false, message: 'Slug chỉ được chứa chữ cái, số, dấu gạch dưới và gạch ngang' });
        }

        const existing = await ShortLink.findOne({ slug });

        if (existing) {
            return res.json({ available: false, message: 'Slug này đã được sử dụng' });
        }

        return res.json({ available: true, message: 'Có thể sử dụng' });
    } catch (error) {
        return res.status(500).json({ available: false, message: error.message });
    }
};

module.exports = { checkSlug, createShortLink, redirectToOriginal, getUserLinks, deleteLink };