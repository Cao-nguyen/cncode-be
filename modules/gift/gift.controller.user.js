const service = require('./gift.service.user');

const getActiveGifts = async (req, res) => {
    try {
        const gifts = await service.getActiveGifts();
        res.json({ success: true, data: gifts });
    } catch (error) {
        console.error('Get active gifts error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy danh sách quà tặng' });
    }
};

const sendGift = async (req, res) => {
    try {
        const transaction = await service.sendGift(req.userId, req.body);
        res.status(201).json({ success: true, data: transaction });
    } catch (error) {
        console.error('Send gift error:', error);
        const status = error.message.includes('Không tìm thấy') ? 404 : 400;
        res.status(status).json({ success: false, message: error.message || 'Lỗi khi gửi quà tặng' });
    }
};

const getReceivedGifts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await service.getReceivedGifts(req.userId, page, limit);

        res.json({
            success: true,
            data: result.transactions,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Get received gifts error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy danh sách quà đã nhận' });
    }
};

const getSentGifts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await service.getSentGifts(req.userId, page, limit);

        res.json({
            success: true,
            data: result.transactions,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Get sent gifts error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy danh sách quà đã gửi' });
    }
};

const getGiftsForTarget = async (req, res) => {
    try {
        const { targetType, targetId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await service.getGiftsForTarget(targetType, targetId, page, limit);

        res.json({
            success: true,
            data: result.transactions,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Get gifts for target error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy danh sách quà tặng' });
    }
};

const convertGifts = async (req, res) => {
    try {
        const result = await service.convertGifts(req.userId, req.params.giftId);

        res.json({
            success: true,
            message: result.message,
            xuReceived: result.xuReceived,
        });
    } catch (error) {
        console.error('Convert gifts error:', error);
        const status = error.message === 'Không tìm thấy quà để quy đổi' ? 404 : 500;
        res.status(status).json({ success: false, message: error.message || 'Lỗi khi quy đổi quà tặng' });
    }
};

module.exports = {
    getActiveGifts,
    sendGift,
    getReceivedGifts,
    getSentGifts,
    getGiftsForTarget,
    convertGifts,
};
