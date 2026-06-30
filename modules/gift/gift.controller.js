const { Gift } = require('./gift.model');
const { GiftTransaction } = require('./gift-transaction.model');
const User = require('../user/user.model');
const { Blog } = require('../blog/blog.model');
const { sendToUser, broadcastToAll } = require('../../services/socket.service');
const notificationService = require('../notification/notification.service');

// Admin: Get all gifts
const getAllGifts = async (req, res) => {
  try {
    const gifts = await Gift.find().sort({ order: 1, createdAt: -1 });
    res.json(gifts);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách quà tặng', error: error.message });
  }
};

// Admin: Create gift
const createGift = async (req, res) => {
  try {
    const { name, description, image, priceInXu, category, isActive, order } = req.body;
    
    const gift = await Gift.create({
      name,
      description,
      image,
      priceInXu,
      category,
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0
    });
    
    res.status(201).json(gift);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tạo quà tặng', error: error.message });
  }
};

// Admin: Update gift
const updateGift = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, priceInXu, category, isActive, order } = req.body;
    
    const gift = await Gift.findByIdAndUpdate(
      id,
      { name, description, image, priceInXu, category, isActive, order },
      { new: true, runValidators: true }
    );
    
    if (!gift) {
      return res.status(404).json({ message: 'Không tìm thấy quà tặng' });
    }
    
    res.json(gift);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật quà tặng', error: error.message });
  }
};

// Admin: Delete gift
const deleteGift = async (req, res) => {
  try {
    const { id } = req.params;
    
    const gift = await Gift.findByIdAndDelete(id);
    
    if (!gift) {
      return res.status(404).json({ message: 'Không tìm thấy quà tặng' });
    }
    
    res.json({ message: 'Đã xóa quà tặng thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa quà tặng', error: error.message });
  }
};

// Public: Get active gifts for shop
const getActiveGifts = async (req, res) => {
  try {
    const gifts = await Gift.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json(gifts);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách quà tặng', error: error.message });
  }
};

// User: Buy and send gift
const sendGift = async (req, res) => {
  try {
    const { giftId, recipientId, targetType, targetId, message } = req.body;
    const senderId = req.userId;
    
    // Validate gift
    const gift = await Gift.findById(giftId);
    if (!gift || !gift.isActive) {
      return res.status(404).json({ message: 'Quà tặng không tồn tại hoặc không khả dụng' });
    }
    
    // Validate sender has enough coins
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ message: 'Không tìm thấy người gửi' });
    }
    
    if (sender.coins < gift.priceInXu) {
      return res.status(400).json({ message: 'Bạn không đủ xu để mua quà tặng này' });
    }
    
    // Validate recipient
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Không tìm thấy người nhận' });
    }

    // Prevent sending gift to self
    if (senderId === recipientId) {
      return res.status(400).json({ message: 'Bạn không thể tự tặng quà cho chính mình' });
    }
    
    // Validate target (user or post)
    if (targetType === 'post') {
      const post = await Blog.findById(targetId);
      if (!post) {
        return res.status(404).json({ message: 'Bài viết không tồn tại' });
      }
    }
    
    // Calculate xu (10% fee)
    const coinsSpent = gift.priceInXu;
    const xuReceived = Math.floor(coinsSpent * 0.9);
    
    // Deduct coins from sender
    sender.coins -= coinsSpent;
    await sender.save();
    
    // Add xu to recipient
    recipient.coins += xuReceived;
    await recipient.save();
    
    // Create transaction record
    const transaction = await GiftTransaction.create({
      sender: senderId,
      recipient: recipientId,
      gift: giftId,
      targetType,
      targetId,
      message: message || '',
      coinsSpent,
      xuReceived
    });
    
    // Populate transaction for response
    const populatedTransaction = await GiftTransaction.findById(transaction._id)
      .populate('sender', 'fullName username avatar')
      .populate('recipient', 'fullName username avatar')
      .populate('gift');
    
    // Emit socket notification to recipient (for toast notification)
    sendToUser(recipientId, 'gift-received', {
      transaction: populatedTransaction,
      sender: {
        fullName: sender.fullName,
        username: sender.username,
        avatar: sender.avatar
      }
    });
    
    // Broadcast to all users for realtime blog gift list update
    broadcastToAll('gift-sent', {
      transaction: populatedTransaction,
      sender: {
        fullName: sender.fullName,
        username: sender.username,
        avatar: sender.avatar
      }
    });

    // Create notification for recipient
    await notificationService.createNotification({
      userId: recipientId,
      senderId: senderId,
      type: 'gift_received',
      content: `${sender.fullName} đã tặng bạn ${gift.name}`,
      meta: {
        coins: xuReceived,
        giftId: gift._id,
        giftName: gift.name,
        giftImage: gift.image,
        targetType,
        targetId
      }
    });
    
    res.status(201).json(populatedTransaction);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi quà tặng', error: error.message });
  }
};

// User: Get received gifts
const getReceivedGifts = async (req, res) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const transactions = await GiftTransaction.find({ recipient: userId })
      .populate('sender', 'fullName username avatar')
      .populate('gift', 'name image priceInXu')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await GiftTransaction.countDocuments({ recipient: userId });
    
    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách quà đã nhận', error: error.message });
  }
};

// User: Get sent gifts
const getSentGifts = async (req, res) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const transactions = await GiftTransaction.find({ sender: userId })
      .populate('recipient', 'fullName username avatar')
      .populate('gift', 'name image priceInXu')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await GiftTransaction.countDocuments({ sender: userId });
    
    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách quà đã gửi', error: error.message });
  }
};

// Get gifts for a specific target (user or post)
const getGiftsForTarget = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const transactions = await GiftTransaction.find({ targetType, targetId })
      .populate('sender', 'fullName username avatar')
      .populate('gift', 'name image priceInXu')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await GiftTransaction.countDocuments({ targetType, targetId });
    
    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách quà tặng', error: error.message });
  }
};

// Convert gifts to xu
const convertGifts = async (req, res) => {
  try {
    const userId = req.userId;
    const { giftId } = req.params;
    
    // Find all transactions with this gift for this user
    const transactions = await GiftTransaction.find({ 
      recipient: userId,
      gift: giftId 
    });
    
    if (transactions.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy quà để quy đổi' });
    }
    
    // Calculate total xu to receive
    const totalXu = transactions.reduce((sum, t) => sum + t.xuReceived, 0);
    
    // Update user coins
    const User = require('../user/user.model');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    
    user.coins += totalXu;
    await user.save();
    
    // Delete the transactions
    await GiftTransaction.deleteMany({ 
      recipient: userId,
      gift: giftId 
    });
    
    res.json({ 
      success: true, 
      message: `Đã quy đổi thành công! Nhận được ${totalXu.toLocaleString()} xu`,
      xuReceived: totalXu
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi quy đổi quà tặng', error: error.message });
  }
};

module.exports = {
  getAllGifts,
  createGift,
  updateGift,
  deleteGift,
  getActiveGifts,
  sendGift,
  getReceivedGifts,
  getSentGifts,
  getGiftsForTarget,
  convertGifts
};
