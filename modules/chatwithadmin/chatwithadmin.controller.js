const ChatWithAdmin = require('./chatwithadmin.model');
const User = require('../user/user.model');

// Get all chats for admin with sorting
exports.getAllChatsForAdmin = async (req, res) => {
  try {
    const adminId = req.userId;
    
    // Verify admin
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền xem danh sách chat'
      });
    }

    // Get all chats with user info
    const chats = await ChatWithAdmin.find()
      .populate('userId', 'fullName email avatar')
      .sort({ unreadCount: -1, lastMessageAt: -1 });

    // Separate unread and read chats
    const unreadChats = chats.filter(chat => chat.unreadCount > 0);
    const readChats = chats.filter(chat => chat.unreadCount === 0 && chat.messages.length > 0);
    const emptyChats = chats.filter(chat => chat.messages.length === 0);

    // Sort unread by lastMessageAt (newest first)
    unreadChats.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    // Sort read by lastMessageAt (newest first)
    readChats.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    // Combine: unread first, then read, then empty
    const sortedChats = [...unreadChats, ...readChats, ...emptyChats];

    res.json({
      success: true,
      data: sortedChats
    });
  } catch (error) {
    console.error('Get all chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách chat'
    });
  }
};

// Get chat by ID
exports.getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await ChatWithAdmin.findById(chatId)
      .populate('userId', 'fullName email avatar')
      .populate('messages.senderId', 'fullName email avatar');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    // Check permission
    const user = await User.findById(userId);
    const isAdmin = user && user.role === 'admin';
    
    if (!isAdmin && chat.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem cuộc trò chuyện này'
      });
    }

    res.json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy cuộc trò chuyện'
    });
  }
};

// Create new chat
exports.createChat = async (req, res) => {
  try {
    const userId = req.userId;

    // Check if chat already exists for this user
    let chat = await ChatWithAdmin.findOne({ userId });

    if (chat) {
      return res.json({
        success: true,
        data: chat
      });
    }

    // Create new chat
    chat = await ChatWithAdmin.create({
      userId,
      messages: [],
      unreadCount: 0,
      userUnreadCount: 0
    });

    res.status(201).json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo cuộc trò chuyện'
    });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  try {
    const { chatId, content } = req.body;
    const userId = req.userId;

    const chat = await ChatWithAdmin.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    // Check permission
    const user = await User.findById(userId);
    const isAdmin = user && user.role === 'admin';
    const senderRole = isAdmin ? 'admin' : 'user';

    if (!isAdmin && chat.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này'
      });
    }

    // Add message
    const message = {
      senderId: userId,
      senderRole,
      content,
      read: false,
      timestamp: new Date()
    };

    chat.messages.push(message);
    chat.lastMessageAt = new Date();

    // Update unread count
    if (senderRole === 'user') {
      chat.unreadCount += 1;
    } else {
      chat.userUnreadCount += 1;
    }

    await chat.save();

    res.json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi tin nhắn'
    });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await ChatWithAdmin.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    // Check permission
    const user = await User.findById(userId);
    const isAdmin = user && user.role === 'admin';

    if (!isAdmin && chat.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật cuộc trò chuyện này'
      });
    }

    // Mark messages as read based on role
    if (isAdmin) {
      // Admin marking user's messages as read
      chat.messages.forEach(msg => {
        if (msg.senderRole === 'user') {
          msg.read = true;
        }
      });
      chat.unreadCount = 0;
    } else {
      // User marking admin's messages as read
      chat.messages.forEach(msg => {
        if (msg.senderRole === 'admin') {
          msg.read = true;
        }
      });
      chat.userUnreadCount = 0;
    }

    await chat.save();

    res.json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi đánh dấu đã đọc'
    });
  }
};

// Delete chat
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await ChatWithAdmin.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    // Check permission
    const user = await User.findById(userId);
    const isAdmin = user && user.role === 'admin';

    if (!isAdmin && chat.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa cuộc trò chuyện này'
      });
    }

    await ChatWithAdmin.findByIdAndDelete(chatId);

    res.json({
      success: true,
      message: 'Đã xóa cuộc trò chuyện'
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa cuộc trò chuyện'
    });
  }
};
