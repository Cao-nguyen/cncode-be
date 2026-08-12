const { Gift } = require('./gift.model');
const { GiftTransaction } = require('./gift-transaction.model');
const User = require('../user/user.model');
const { Blog } = require('../blog/blog.model');
const { sendToUser, broadcastToAll } = require('../../services/socket.service');
const notificationService = require('../notification/notification.service');

async function getActiveGifts() {
    return Gift.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
}

async function sendGift(senderId, data) {
    const { giftId, recipientId, targetType, targetId, message } = data;

    const gift = await Gift.findById(giftId);
    if (!gift || !gift.isActive) {
        throw new Error('Quà tặng không tồn tại hoặc không khả dụng');
    }

    const sender = await User.findById(senderId);
    if (!sender) {
        throw new Error('Không tìm thấy người gửi');
    }

    if (sender.coins < gift.priceInXu) {
        throw new Error('Bạn không đủ xu để mua quà tặng này');
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
        throw new Error('Không tìm thấy người nhận');
    }

    if (String(senderId) === String(recipientId)) {
        throw new Error('Bạn không thể tự tặng quà cho chính mình');
    }

    if (targetType === 'post') {
        const post = await Blog.findById(targetId);
        if (!post) {
            throw new Error('Bài viết không tồn tại');
        }
    }

    const coinsSpent = gift.priceInXu;
    const xuReceived = Math.floor(coinsSpent * 0.9);

    sender.coins -= coinsSpent;
    await sender.save();

    recipient.coins += xuReceived;
    await recipient.save();

    const transaction = await GiftTransaction.create({
        sender: senderId,
        recipient: recipientId,
        gift: giftId,
        targetType,
        targetId,
        message: message || '',
        coinsSpent,
        xuReceived,
    });

    const populatedTransaction = await GiftTransaction.findById(transaction._id)
        .populate('sender', 'fullName username avatar')
        .populate('recipient', 'fullName username avatar')
        .populate('gift');

    sendToUser(recipientId, 'gift-received', {
        transaction: populatedTransaction,
        sender: {
            fullName: sender.fullName,
            username: sender.username,
            avatar: sender.avatar,
        },
    });

    broadcastToAll('gift-sent', {
        transaction: populatedTransaction,
        sender: {
            fullName: sender.fullName,
            username: sender.username,
            avatar: sender.avatar,
        },
    });

    await notificationService.createNotification({
        userId: recipientId,
        senderId,
        type: 'gift_received',
        content: `${sender.fullName} đã tặng bạn ${gift.name}`,
        meta: {
            coins: xuReceived,
            giftId: gift._id,
            giftName: gift.name,
            giftImage: gift.image,
            targetType,
            targetId,
            url: '/me/shop',
        },
    });

    return populatedTransaction;
}

async function getReceivedGifts(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const transactions = await GiftTransaction.find({ recipient: userId })
        .populate('sender', 'fullName username avatar')
        .populate('gift', 'name image priceInXu')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await GiftTransaction.countDocuments({ recipient: userId });

    return {
        transactions,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

async function getSentGifts(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const transactions = await GiftTransaction.find({ sender: userId })
        .populate('recipient', 'fullName username avatar')
        .populate('gift', 'name image priceInXu')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await GiftTransaction.countDocuments({ sender: userId });

    return {
        transactions,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

async function getGiftsForTarget(targetType, targetId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const transactions = await GiftTransaction.find({ targetType, targetId })
        .populate('sender', 'fullName username avatar')
        .populate('gift', 'name image priceInXu')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await GiftTransaction.countDocuments({ targetType, targetId });

    return {
        transactions,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

async function convertGifts(userId, giftId) {
    const transactions = await GiftTransaction.find({
        recipient: userId,
        gift: giftId,
        isConverted: { $ne: true },
    });

    if (transactions.length === 0) {
        throw new Error('Không tìm thấy quà để quy đổi');
    }

    const totalXu = transactions.reduce((sum, t) => sum + t.xuReceived, 0);

    const user = await User.findById(userId);
    if (!user) {
        throw new Error('Không tìm thấy người dùng');
    }

    user.coins += totalXu;
    await user.save();

    await GiftTransaction.updateMany(
        { recipient: userId, gift: giftId, isConverted: { $ne: true } },
        { isConverted: true, convertedAt: new Date() }
    );

    return {
        xuReceived: totalXu,
        message: `Đã quy đổi thành công! Nhận được ${totalXu.toLocaleString()} xu`,
    };
}

module.exports = {
    getActiveGifts,
    sendGift,
    getReceivedGifts,
    getSentGifts,
    getGiftsForTarget,
    convertGifts,
};
