// modules/auth/auth.service.js
const User = require('../user/user.model');
const Notification = require('../notification/notification.model');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const verifyGoogleToken = async (credential) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return {
    email: payload.email,
    fullName: payload.name,
    avatar: payload.picture,
  };
};

const findOrCreateUser = async (payload) => {
  let user = await User.findOne({ email: payload.email });
  let isNewUser = false;
  let bonusNotification = null;

  if (!user) {
    user = await User.create({
      email: payload.email,
      fullName: payload.fullName,
      avatar: payload.avatar,
      isOnboarded: false,
      coins: 100,
      streak: 0,
    });
    isNewUser = true;

    bonusNotification = {
      userId: user._id,
      type: 'first_login_bonus',
      content: `Chào mừng ${user.fullName}! Bạn nhận được 100 xu khi đăng nhập lần đầu.`,
      meta: { coins: 100 },
      read: false,
      createdAt: new Date(),
    };

    await Notification.create(bonusNotification);
  }

  return { user, isNewUser, bonusNotification };
};

const checkUsername = async (username) => {
  const existingUser = await User.findOne({ username });
  return !existingUser;
};

const updateOnboarding = async (userId, data) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.username) {
    throw new Error('User already onboarded');
  }

  const existingUsername = await User.findOne({ username: data.username });
  if (existingUsername && existingUsername._id.toString() !== userId) {
    throw new Error('Tên người dùng đã tồn tại');
  }

  user.username = data.username;
  user.class = data.class;
  user.province = data.province;
  user.school = data.school;
  user.birthday = new Date(data.birthday);
  user.bio = data.bio || '';
  user.isOnboarded = true;

  await user.save();
  return user;
};

const getMe = async (userId) => {
  return await User.findById(userId).select('-password -violations');
};

const updateStreak = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActive = new Date(user.lastActiveAt);
  lastActive.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
  let newStreak = user.streak;
  let coinsEarned = 0;

  if (diffDays === 1) {
    newStreak = user.streak + 1;
    coinsEarned = newStreak * 10;
  } else if (diffDays > 1) {
    newStreak = 1;
    coinsEarned = 10;
  } else if (diffDays === 0) {
    return {
      streak: user.streak,
      coinsEarned: 0,
      totalCoins: user.coins,
    };
  }

  user.streak = newStreak;
  user.coins += coinsEarned;
  user.lastActiveAt = new Date();
  await user.save();

  let bonusNotification = null;
  if (newStreak === 7 || newStreak === 30 || newStreak === 100) {
    const milestoneBonus = newStreak === 7 ? 50 : newStreak === 30 ? 200 : 500;
    user.coins += milestoneBonus;
    await user.save();

    bonusNotification = {
      userId: user._id,
      type: 'streak_bonus',
      content: `🔥 Thành tựu đặc biệt: Bạn đã đạt streak ${newStreak} ngày! Nhận thưởng ${milestoneBonus} xu.`,
      meta: { coins: milestoneBonus, streak: newStreak },
      read: false,
      createdAt: new Date(),
    };
    await Notification.create(bonusNotification);
    coinsEarned += milestoneBonus;
  }

  return {
    streak: user.streak,
    coinsEarned,
    totalCoins: user.coins,
    bonusNotification,
  };
};

const getAdminUsers = async () => {
  return await User.find({ role: 'admin' }).select('_id');
};

module.exports = {
  generateToken,
  verifyGoogleToken,
  findOrCreateUser,
  checkUsername,
  updateOnboarding,
  getMe,
  updateStreak,
  getAdminUsers,
};