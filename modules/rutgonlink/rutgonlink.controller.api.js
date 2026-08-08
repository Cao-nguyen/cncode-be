const { batchCreateShortLinks, getUserLinksViaApiKey } = require('./rutgonlink.services.api');

const batchCreateHandler = async (req, res) => {
    try {
        const userId = req.userId;
        const { links, expiresInHours } = req.body;

        if (!links || !Array.isArray(links) || links.length === 0) {
            return res.status(400).json({ success: false, message: 'Links array is required' });
        }

        if (links.length > 100) {
            return res.status(400).json({ success: false, message: 'Maximum 100 links per batch' });
        }

        const result = await batchCreateShortLinks(userId, links, expiresInHours);

        res.json(result);
    } catch (error) {
        console.error('Batch create short links error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

const getUserLinksHandler = async (req, res) => {
    try {
        const userId = req.userId;
        const { page = 1, limit = 20, search } = req.query;

        const result = await getUserLinksViaApiKey(userId, parseInt(page), parseInt(limit), search);

        res.json(result);
    } catch (error) {
        console.error('Get user links error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

module.exports = {
    batchCreate: batchCreateHandler,
    getUserLinks: getUserLinksHandler
};
