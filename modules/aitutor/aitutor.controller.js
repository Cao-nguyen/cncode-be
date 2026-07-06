const AIChat = require('./aitutor.model');
const Groq = require('groq-sdk');
const User = require('../user/user.model');

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const MODEL_NAME = 'llama-3.3-70b-versatile';

// Rate limiting: 3 messages per day per user
const RATE_LIMIT_PER_DAY = 3;

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
    const { chatId, message } = req.body;
    const userId = req.userId;
    
    // Check if user is admin (no rate limit for admin)
    const user = await User.findById(userId);
    const isAdmin = user && user.role === 'admin';
    
    // Check rate limit (skip for admin)
    if (!isAdmin) {
      const rateLimit = await checkRateLimit(userId);
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
    
    if (!chat) {
      chat = await AIChat.create({
        userId,
        messages: [],
        title: message.substring(0, 50) + (message.length > 50 ? '...' : '')
      });
    }
    
    // Add user message
    chat.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });
    
    // Prepare conversation history for AI
    const conversationHistory = chat.messages.slice(-10).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    
    // Call Groq AI
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Bạn là một Gia sư Tin học chuyên nghiệp. Giải thích ngắn gọn, dễ hiểu, có ví dụ code. Ngôn ngữ: Tiếng Việt'
        },
        ...conversationHistory.map((msg) => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      ],
      model: MODEL_NAME,
      temperature: 0.7,
      max_tokens: 2048,
    });

    const aiMessage = chatCompletion.choices[0]?.message?.content || 'Không có phản hồi từ AI.';
    
    // Add AI response
    chat.messages.push({
      role: 'assistant',
      content: aiMessage,
      timestamp: new Date()
    });
    
    chat.lastMessageAt = new Date();
    await chat.save();
    
    res.json({
      success: true,
      data: {
        message: aiMessage,
        chat: chat,
        remaining: rateLimit.remaining - 1
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi tin nhắn'
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

exports.getRateLimit = async (req, res) => {
  try {
    const userId = req.userId;
    const rateLimit = await checkRateLimit(userId);
    
    res.json({
      success: true,
      data: rateLimit
    });
  } catch (error) {
    console.error('Get rate limit error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi kiểm tra giới hạn'
    });
  }
};
