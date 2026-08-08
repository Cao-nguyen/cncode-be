const User = require('../modules/user/user.model');

const validateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;

        if (!apiKey) {
            return res.status(401).json({ success: false, message: 'API Key is required' });
        }

        const user = await User.findOne({ apiKey });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid API Key' });
        }

        if (user.isBanned) {
            return res.status(403).json({ success: false, message: 'User is banned' });
        }

        req.userId = user._id;
        req.user = user;
        next();
    } catch (error) {
        console.error('Validate API Key error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { validateApiKey };
