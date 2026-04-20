const shortlinkService = require('./shortlink.service');

const createShortLink = async (req, res) => {
    try {
        const { url, customSlug } = req.body;
        const userId = req.userId || null;

        if (!url) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập URL' });
        }

        const slug = customSlug || Math.random().toString(36).substring(2, 8);

        const shortLink = await shortlinkService.createShortLink(url, slug, userId);

        res.json({
            success: true,
            data: { shortCode: shortLink.slug, originalUrl: shortLink.originalUrl }
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
      <head><title>Link không tồn tại</title><meta charset="utf-8"></head>
      <body style="font-family: system-ui; text-align: center; padding: 50px;">
        <h1>🔗 Link không tồn tại</h1>
        <p>${error.message}</p>
        <a href="/">Về trang chủ</a>
      </body>
      </html>
    `);
    }
};

module.exports = { createShortLink, redirectToOriginal };