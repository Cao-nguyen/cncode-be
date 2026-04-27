const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../user/user.model');
const notificationService = require('../notification/notification.service');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const verifyGoogleToken = async (credential) => {
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  return ticket.getPayload();
};

const findOrCreateUser = async (payload) => {
  const { sub: googleId, email, name, picture } = payload;

  let user = await User.findOne({ googleId });
  if (user) {
    return { user, isNewUser: false };
  }

  user = await User.findOne({ email });
  if (user) {
    user.googleId = googleId;
    user.avatar = picture || user.avatar;
    await user.save();
    return { user, isNewUser: false };
  }

  // Tạo user mới với 100 xu
  user = await User.create({
    googleId,
    email,
    fullName: name,
    avatar: picture || '',
    isOnboarded: false,
    coins: 100,
    streak: 0,
    lastActiveAt: null
  });

  // Tạo notification "nhận 100 xu" lưu vào DB
  const notification = await notificationService.createNotification({
    userId: user._id,
    senderId: null, // system notification
    type: 'first_login_bonus',
    content: 'Chào mừng bạn đến với CNcode! Bạn đã nhận được 100 xu để bắt đầu hành trình học tập.',
    meta: { coins: 100, streak: 0 }
  });

  return { user, isNewUser: true, bonusNotification: notification };
};

const checkUsername = async (username) => {
  if (!username || username.length < 3) return false;
  const existing = await User.findOne({ username });
  return !existing;
};

const updateOnboarding = async (userId, onboardingData) => {
  const { username, class: className, province, school, birthday, bio } = onboardingData;

  const existingUser = await User.findOne({
    username: { $regex: new RegExp(`^${username}$`, 'i') },
    _id: { $ne: userId }
  });
  if (existingUser) throw new Error('Tên người dùng đã tồn tại');

  const user = await User.findByIdAndUpdate(
    userId,
    { username, class: className, province, school, birthday, bio: bio || '', isOnboarded: true },
    { new: true, runValidators: true }
  );
  if (!user) throw new Error('Không tìm thấy người dùng');
  return user;
};

const getMe = async (userId) => {
  return User.findById(userId).select('-googleId');
};

const updateStreak = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
  if (lastActive) lastActive.setHours(0, 0, 0, 0);

  // Đã cập nhật hôm nay rồi thì không tính lại
  if (lastActive && lastActive.getTime() === today.getTime()) {
    return { streak: user.streak, coinsEarned: 0, totalCoins: user.coins };
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let newStreak = user.streak;
  if (lastActive && lastActive.getTime() === yesterday.getTime()) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  // Thưởng milestone streak
  let coinsEarned = 10;
  let streakReset = false;
  if (newStreak === 7) {
    coinsEarned = 50;
    newStreak = 0;
    streakReset = true;
  } else if (newStreak === 30) {
    coinsEarned = 300;
    newStreak = 0;
    streakReset = true;
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      $inc: { coins: coinsEarned },
      $set: { streak: newStreak, lastActiveAt: today }
    },
    { new: true }
  );

  // Tạo notification streak bonus nếu có milestone
  let bonusNotification = null;
  if (streakReset) {
    bonusNotification = await notificationService.createNotification({
      userId,
      type: 'streak_bonus',
      content: `Chúc mừng! Bạn đã duy trì streak ${user.streak} ngày và nhận được ${coinsEarned} xu thưởng!`,
      meta: { coins: coinsEarned, streak: user.streak }
    });
  }

  return {
    streak: newStreak,
    coinsEarned,
    totalCoins: updatedUser.coins,
    bonusNotification
  };
};

module.exports = {
  verifyGoogleToken,
  findOrCreateUser,
  generateToken,
  checkUsername,
  updateOnboarding,
  getMe,
  updateStreak
};