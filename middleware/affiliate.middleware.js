
const affiliateService = require('../modules/affiliate/affiliate.service');

const affiliateMiddleware = async (req, res, next) => {
    
    const referrerCode = req.cookies[affiliateService.REFERRAL_COOKIE_NAME];

    console.log('🔍 [AFFILIATE] Cookie ref:', referrerCode);
    console.log('🔍 [AFFILIATE] Request path:', req.path);

    if (referrerCode) {
        req.affiliateCode = referrerCode;
        console.log('✅ [AFFILIATE] Found affiliate code:', referrerCode);
    }

    next();
};

module.exports = affiliateMiddleware;
