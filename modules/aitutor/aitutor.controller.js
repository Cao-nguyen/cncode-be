const AIChat = require('./aitutor.model');
const User = require('../user/user.model');
const { buildImageParts, buildUserDisplayContent, sanitizeAttachmentsForStorage } = require('./aitutor.attachments');
const { generateTutorResponse } = require('./aitutor.ai.service');

// Rate limiting: 5 messages per day per user
const RATE_LIMIT_PER_DAY = 5;

const checkRateLimit = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Count messages sent today across all chats
  const chats = await AIChat.find({ userId });
  let totalMessages = 0;
  
  for (const chat of chats) {
    const messagesToday = chat.messages.filter(msg => {
      const msgDate = new Date(msg.timestamp);
      return msgDate >= today && msgDate < tomorrow && msg.role === 'user';
    });
    totalMessages += messagesToday.length;
  }
  
  return {
    allowed: totalMessages < RATE_LIMIT_PER_DAY,
    remaining: RATE_LIMIT_PER_DAY - totalMessages,
    used: totalMessages
  };
};

exports.createChat = async (req, res) => {
  try {
    const userId = req.userId;
    
    const chat = await AIChat.create({
      userId,
      messages: [],
      title: 'Cuộc trò chuyện mới'
    });
    
    res.json({
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

exports.getChats = async (req, res) => {
  try {
    const userId = req.userId;
    
    const chats = await AIChat.find({ userId })
      .sort({ lastMessageAt: -1 })
      .limit(20);
    
    res.json({
      success: true,
      data: chats
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách cuộc trò chuyện'
    });
  }
};

exports.getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;
    
    const chat = await AIChat.findOne({ _id: chatId, userId });
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
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

exports.sendMessage = async (req, res) => {
  try {
    const { chatId, message, attachments = [] } = req.body;
    const userId = req.userId;

    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    const safeAttachments = sanitizeAttachmentsForStorage(
      Array.isArray(attachments) ? attachments : []
    );

    if (!trimmedMessage && safeAttachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập câu hỏi hoặc đính kèm ảnh'
      });
    }

    if (safeAttachments.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ được gửi tối đa 3 ảnh mỗi lần'
      });
    }
    
    // Check if user is admin (no rate limit for admin)
    const user = await User.findById(userId);
    const isAdmin = user && user.role === 'admin';
    
    // Check rate limit (skip for admin)
    let rateLimit;
    if (!isAdmin) {
      rateLimit = await checkRateLimit(userId);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: `Bạn đã dùng hết ${RATE_LIMIT_PER_DAY} lần dùng AI hôm nay. Hãy quay lại vào ngày mai!`,
          remaining: rateLimit.remaining,
          used: rateLimit.used
        });
      }
    }
    
    // Get or create chat
    let chat;
    if (chatId) {
      chat = await AIChat.findOne({ _id: chatId, userId });
    }
    
    const titleSource = trimmedMessage || safeAttachments[0]?.name || 'Cuộc trò chuyện mới';

    if (!chat) {
      chat = await AIChat.create({
        userId,
        messages: [],
        title: titleSource.substring(0, 50) + (titleSource.length > 50 ? '...' : '')
      });
    } else if (chat.messages.length === 0) {
      chat.title = titleSource.substring(0, 50) + (titleSource.length > 50 ? '...' : '');
    }
    
    let imageParts = [];
    try {
      imageParts = await buildImageParts(Array.isArray(attachments) ? attachments : safeAttachments);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Ảnh đính kèm không hợp lệ',
      });
    }

    if (safeAttachments.length > 0 && imageParts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không đọc được ảnh đính kèm. Vui lòng chọn lại ảnh.',
      });
    }

    const conversationHistory = chat.messages.slice(-10).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    const aiMessage = await generateTutorResponse({
      trimmedMessage,
      imageParts,
      conversationHistory,
    });
    
    // Add both messages only after AI responds successfully
    chat.messages.push({
      role: 'user',
      content: buildUserDisplayContent(trimmedMessage, safeAttachments),
      attachments: safeAttachments,
      timestamp: new Date()
    });
    
    chat.messages.push({
      role: 'assistant',
      content: aiMessage,
      timestamp: new Date()
    });
    
    chat.lastMessageAt = new Date();
    await chat.save();
    
    // Calculate remaining after sending
    let remaining = 0;
    if (!isAdmin) {
      const newRateLimit = await checkRateLimit(userId);
      remaining = newRateLimit.remaining;
    }
    
    res.json({
      success: true,
      data: {
        message: aiMessage,
        chat: chat,
        remaining: remaining
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Lỗi khi gửi tin nhắn'
    });
  }
};

exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await AIChat.findOneAndDelete({ _id: chatId, userId });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

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

exports.deleteChatAdmin = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền xóa cuộc trò chuyện'
      });
    }

    const chat = await AIChat.findByIdAndDelete(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    res.json({
      success: true,
      message: 'Đã xóa cuộc trò chuyện'
    });
  } catch (error) {
    console.error('Delete chat admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa cuộc trò chuyện'
    });
  }
};

exports.deleteMessageAdmin = async (req, res) => {
  try {
    const { chatId, messageIndex } = req.params;
    const userId = req.userId;

    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền xóa tin nhắn'
      });
    }

    const chat = await AIChat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    // Remove message at specific index and its assistant response
    const index = parseInt(messageIndex);
    if (index < 0 || index >= chat.messages.length) {
      return res.status(400).json({
        success: false,
        message: 'Index tin nhắn không hợp lệ'
      });
    }

    console.log(`Deleting message at index ${index} from chat ${chatId}. Total messages before: ${chat.messages.length}`);

    // Remove the user message
    chat.messages.splice(index, 1);

    // If the next message is an assistant response, remove it too
    if (index < chat.messages.length && chat.messages[index].role === 'assistant') {
      console.log(`Also removing assistant response at index ${index}`);
      chat.messages.splice(index, 1);
    }

    await chat.save();

    console.log(`Message(s) deleted. Total messages after: ${chat.messages.length}`);

    res.json({
      success: true,
      message: 'Đã xóa tin nhắn',
      data: chat
    });
  } catch (error) {
    console.error('Delete message admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa tin nhắn'
    });
  }
};

exports.getRateLimit = async (req, res) => {
  try {
    const userId = req.userId;
    const rateLimit = await checkRateLimit(userId);
    res.json({
      success: true,
      data: rateLimit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getAllChatsAdmin = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền truy cập'
      });
    }
    
    // Get all chats with user info
    const chats = await AIChat.find().sort({ updatedAt: -1 }).lean();
    
    // Enrich with user info
    const enrichedChats = await Promise.all(chats.map(async (chat) => {
      const chatUser = await User.findById(chat.userId).select('fullName email').lean();
      return {
        ...chat,
        user: chatUser || { fullName: 'Unknown', email: 'Unknown' }
      };
    }));
    
    res.json({
      success: true,
      data: enrichedChats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getChatByIdAdmin = async (req, res) => {
  try {
    const userId = req.userId;
    const { chatId } = req.params;
    
    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền truy cập'
      });
    }
    
    const chat = await AIChat.findById(chatId).lean();
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }
    
    // Get user info
    const chatUser = await User.findById(chat.userId).select('fullName email').lean();
    
    res.json({
      success: true,
      data: {
        ...chat,
        user: chatUser || { fullName: 'Unknown', email: 'Unknown' }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.pinChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { isPinned } = req.body;
    const userId = req.userId;
    
    const chat = await AIChat.findOneAndUpdate(
      { _id: chatId, userId },
      { isPinned: isPinned },
      { new: true }
    );
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }
    
    res.json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('Pin chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi ghim cuộc trò chuyện'
    });
  }
};

exports.renameChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { title } = req.body;
    const userId = req.userId;
    
    const chat = await AIChat.findOneAndUpdate(
      { _id: chatId, userId },
      { title },
      { new: true }
    );
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }
    
    res.json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('Rename chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi đổi tên cuộc trò chuyện'
    });
  }
};
