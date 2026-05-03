// modules/affiliate/affiliate.service.js
const crypto = require('crypto');
const { AffiliateLink, AffiliateUser } = require('./affiliate.model');
const User = require('../user/user.model');
const Notification = require('../notification/notification.model');

const BASE_URL = process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
const REFERRAL_COOKIE_NAME = 'ref';
const REFERRAL_COOKIE_DAYS = 30;

const REWARDS = {
    register: 100,
    create_post: 30,
    take_quiz: 20,
};

function generateReferralCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function getIo() {
    try {
        const io = require('../../server').getIo?.() || null;
        console.log('🔌 getIo result:', io ? 'OK' : 'NULL'); // thêm dòng này
        return io;
    } catch (e) {
        console.error('❌ getIo error:', e.message);
        return null;
    }
}

async function getOrCreateAffiliateLink(userId) {
    let affiliate = await AffiliateLink.findOne({ userId });

    if (!affiliate) {
        let code;
        let isUnique = false;

        while (!isUnique) {
            code = generateReferralCode();
            const existing = await AffiliateLink.findOne({ code });
            if (!existing) isUnique = true;
        }

        affiliate = await AffiliateLink.create({ userId, code });
        console.log(`✅ Created affiliate code ${code} for user ${userId}`);
    }

    return affiliate;
}

async function getAffiliateByCode(code) {
    return await AffiliateLink.findOne({ code });
}

async function trackClick(code) {
    const affiliate = await AffiliateLink.findOne({ code });
    if (affiliate) {
        affiliate.clicks += 1;
        await affiliate.save();
    }
    return affiliate;
}

async function trackRegistration(affiliateCode, targetUser) {
    const affiliate = await AffiliateLink.findOne({ code: affiliateCode });
    if (!affiliate) return null;

    // Không tự giới thiệu chính mình
    if (affiliate.userId.toString() === targetUser._id.toString()) return null;

    // Đã được tracked rồi thì bỏ qua
    const existing = await AffiliateUser.findOne({ targetUserId: targetUser._id });
    if (existing) return null;

    const affiliateUser = await AffiliateUser.create({
        affiliateCode,
        affiliateUserId: affiliate.userId,
        targetUserId: targetUser._id,
        targetEmail: targetUser.email,
        targetName: targetUser.fullName,
        registeredAt: new Date(),
        coinsEarned: REWARDS.register,
    });

    const referrer = await User.findById(affiliate.userId);
    if (!referrer) return affiliateUser;

    referrer.coins += REWARDS.register;
    await referrer.save();

    const notification = await Notification.create({
        userId: affiliate.userId,
        type: 'system',
        content: `${targetUser.fullName} đã đăng ký qua link giới thiệu của bạn! +${REWARDS.register} xu`,
        meta: { coins: REWARDS.register },
    });

    const io = getIo();
    if (io) {
        const roomId = affiliate.userId.toString();

        // Cập nhật coins realtime
        io.to(roomId).emit('coins_updated', {
            userId: affiliate.userId,
            coins: referrer.coins,
            amount: REWARDS.register,
        });

        // Thông báo realtime
        io.to(roomId).emit('new_notification', {
            _id: notification._id,
            userId: affiliate.userId,
            type: 'system',
            content: notification.content,
            meta: { coins: REWARDS.register },
            read: false,
            createdAt: notification.createdAt,
        });

        // 👇 Event riêng để trang affiliate biết cần re-fetch
        io.to(roomId).emit('affiliate_updated', {
            type: 'new_registration',
            targetName: targetUser.fullName,
            coinsEarned: REWARDS.register,
        });
    }

    return affiliateUser;
}

async function trackPost(userId) {
    const affiliateUser = await AffiliateUser.findOne({ targetUserId: userId });
    if (!affiliateUser) return null;
    if (affiliateUser.hasPosted) return null;

    affiliateUser.hasPosted = true;
    affiliateUser.postedAt = new Date();
    affiliateUser.coinsEarned += REWARDS.create_post;
    await affiliateUser.save();

    const referrer = await User.findById(affiliateUser.affiliateUserId);
    if (!referrer) return affiliateUser;

    referrer.coins += REWARDS.create_post;
    await referrer.save();

    const notification = await Notification.create({
        userId: affiliateUser.affiliateUserId,
        type: 'system',
        content: `${affiliateUser.targetName} đã đăng bài viết mới! +${REWARDS.create_post} xu`,
        meta: { coins: REWARDS.create_post },
    });

    const io = getIo();
    if (io) {
        const roomId = affiliateUser.affiliateUserId.toString();

        io.to(roomId).emit('coins_updated', {
            userId: affiliateUser.affiliateUserId,
            coins: referrer.coins,
            amount: REWARDS.create_post,
        });

        io.to(roomId).emit('new_notification', {
            _id: notification._id,
            userId: affiliateUser.affiliateUserId,
            type: 'system',
            content: notification.content,
            meta: { coins: REWARDS.create_post },
            read: false,
            createdAt: notification.createdAt,
        });

        io.to(roomId).emit('affiliate_updated', {
            type: 'post_created',
            targetName: affiliateUser.targetName,
            coinsEarned: REWARDS.create_post,
        });
    }

    return affiliateUser;
}

async function trackQuiz(userId) {
    const affiliateUser = await AffiliateUser.findOne({ targetUserId: userId });
    if (!affiliateUser) return null;
    if (affiliateUser.hasTakenQuiz) return null;

    affiliateUser.hasTakenQuiz = true;
    affiliateUser.takenQuizAt = new Date();
    affiliateUser.coinsEarned += REWARDS.take_quiz;
    await affiliateUser.save();

    const referrer = await User.findById(affiliateUser.affiliateUserId);
    if (!referrer) return affiliateUser;

    referrer.coins += REWARDS.take_quiz;
    await referrer.save();

    const notification = await Notification.create({
        userId: affiliateUser.affiliateUserId,
        type: 'system',
        content: `${affiliateUser.targetName} đã hoàn thành bài kiểm tra! +${REWARDS.take_quiz} xu`,
        meta: { coins: REWARDS.take_quiz },
    });

    const io = getIo();
    if (io) {
        const roomId = affiliateUser.affiliateUserId.toString();

        io.to(roomId).emit('coins_updated', {
            userId: affiliateUser.affiliateUserId,
            coins: referrer.coins,
            amount: REWARDS.take_quiz,
        });

        io.to(roomId).emit('new_notification', {
            _id: notification._id,
            userId: affiliateUser.affiliateUserId,
            type: 'system',
            content: notification.content,
            meta: { coins: REWARDS.take_quiz },
            read: false,
            createdAt: notification.createdAt,
        });

        io.to(roomId).emit('affiliate_updated', {
            type: 'quiz_taken',
            targetName: affiliateUser.targetName,
            coinsEarned: REWARDS.take_quiz,
        });
    }

    return affiliateUser;
}

async function getAffiliateStats(userId) {
    const affiliate = await AffiliateLink.findOne({ userId });
    if (!affiliate) return null;

    const referredUsers = await AffiliateUser.find({ affiliateCode: affiliate.code })
        .sort({ registeredAt: -1 });

    return {
        code: affiliate.code,
        link: `${BASE_URL}/track?ref=${affiliate.code}`,
        clicks: affiliate.clicks,
        totalRegistered: referredUsers.length,
        totalPosted: referredUsers.filter(u => u.hasPosted).length,
        totalTakenQuiz: referredUsers.filter(u => u.hasTakenQuiz).length,
        totalCoinsEarned: referredUsers.reduce((sum, u) => sum + u.coinsEarned, 0),
        referredUsers: referredUsers.map(u => ({
            name: u.targetName,
            email: u.targetEmail,
            registeredAt: u.registeredAt,
            hasPosted: u.hasPosted,
            postedAt: u.postedAt,
            hasTakenQuiz: u.hasTakenQuiz,
            takenQuizAt: u.takenQuizAt,
            coinsEarned: u.coinsEarned,
        })),
    };
}

async function getAllAffiliateStats(page = 1, limit = 20, search = '') {
    const skip = (page - 1) * limit;

    const [affiliateLinks, total] = await Promise.all([
        AffiliateLink.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'fullName email username'),
        AffiliateLink.countDocuments(),
    ]);

    const stats = await Promise.all(affiliateLinks.map(async (link) => {
        const referredUsers = await AffiliateUser.find({ affiliateCode: link.code });
        return {
            _id: link._id,
            user: link.userId,
            code: link.code,
            link: `${BASE_URL}/track?ref=${link.code}`,
            clicks: link.clicks,
            totalRegistered: referredUsers.length,
            totalPosted: referredUsers.filter(u => u.hasPosted).length,
            totalTakenQuiz: referredUsers.filter(u => u.hasTakenQuiz).length,
            totalCoinsEarned: referredUsers.reduce((sum, u) => sum + u.coinsEarned, 0),
            createdAt: link.createdAt,
        };
    }));

    return { stats, total, page, totalPages: Math.ceil(total / limit) };
}

async function getLeaderboard(limit = 10) {
    const leaderboard = await AffiliateUser.aggregate([
        {
            $group: {
                _id: '$affiliateUserId',
                totalRegistered: { $sum: 1 },
                totalPosted: { $sum: { $cond: ['$hasPosted', 1, 0] } },
                totalTakenQuiz: { $sum: { $cond: ['$hasTakenQuiz', 1, 0] } },
                totalCoins: { $sum: '$coinsEarned' },
            },
        },
        { $sort: { totalRegistered: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user',
            },
        },
        { $unwind: '$user' },
        {
            $project: {
                _id: 1,
                totalRegistered: 1,
                totalPosted: 1,
                totalTakenQuiz: 1,
                totalCoins: 1,
                'user.fullName': 1,
                'user.avatar': 1,
                'user.username': 1,
            },
        },
    ]);

    return leaderboard;
}

module.exports = {
    getOrCreateAffiliateLink,
    getAffiliateByCode,
    trackClick,
    trackRegistration,
    trackPost,
    trackQuiz,
    getAffiliateStats,
    getAllAffiliateStats,
    getLeaderboard,
    REFERRAL_COOKIE_NAME,
    REFERRAL_COOKIE_DAYS,
    REWARDS,
};