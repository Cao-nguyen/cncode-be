// modules/affiliate/affiliate.controller.js
const affiliateService = require('./affiliate.service');

const getMyAffiliate = async (req, res) => {
    try {
        await affiliateService.getOrCreateAffiliateLink(req.userId);
        const stats = await affiliateService.getAffiliateStats(req.userId);

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('Get affiliate error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getLeaderboard = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const leaderboard = await affiliateService.getLeaderboard(limit);

        res.json({
            success: true,
            data: leaderboard,
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAllAffiliateStats = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';

        const result = await affiliateService.getAllAffiliateStats(page, limit, search);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Get all affiliate stats error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const trackReferral = async (req, res) => {
    try {
        const { ref } = req.query;
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

        if (ref) {
            const affiliate = await affiliateService.getAffiliateByCode(ref);

            if (affiliate) {
                res.cookie(affiliateService.REFERRAL_COOKIE_NAME, ref, {
                    maxAge: affiliateService.REFERRAL_COOKIE_DAYS * 24 * 60 * 60 * 1000,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                });

                await affiliateService.trackClick(ref);
                console.log('✅ Tracked click for code:', ref);
            }
        }

        res.redirect(FRONTEND_URL);
    } catch (error) {
        console.error('Track referral error:', error);
        res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
    }
};

module.exports = {
    getMyAffiliate,
    getLeaderboard,
    getAllAffiliateStats,
    trackReferral,
};