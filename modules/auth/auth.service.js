const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../user/user.model');

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

  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      user.googleId = googleId;
      user.avatar = picture || user.avatar;
      await user.save();
      return { user, isNewUser: false };
    }

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
    return { user, isNewUser: true };
  }

  return { user, isNewUser: false };
};

const checkUsername = async (username) => {
  if (!username || username.length < 3) {
    return false;
  }
  const existingUser = await User.findOne({ username });
  return !existingUser;
};

const updateOnboarding = async (userId, onboardingData) => {
  const { username, class: className, province, school, birthday, bio } = onboardingData;

  const existingUser = await User.findOne({
    username: { $regex: new RegExp(`^${username}$`, 'i') },
    _id: { $ne: userId }
  });

  if (existingUser) {
    throw new Error('Tên người dùng đã tồn tại');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    {
      username,
      class: className,
      province,
      school,
      birthday,
      bio: bio || '',
      isOnboarded: true
    },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new Error('Không tìm thấy người dùng');
  }

  return user;
};

const getMe = async (userId) => {
  const user = await User.findById(userId).select('-googleId');
  return user;
};

const updateStreak = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
  lastActive?.setHours(0, 0, 0, 0);

  let newStreak = user.streak;
  let coinsEarned = 0;

  if (!lastActive || lastActive.getTime() !== today.getTime()) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastActive && lastActive.getTime() === yesterday.getTime()) {
      newStreak += 1;
    } else if (!lastActive || lastActive.getTime() < yesterday.getTime()) {
      newStreak = 1;
    }

    if (newStreak === 7) {
      coinsEarned = 50;
      newStreak = 0;
    } else if (newStreak === 30) {
      coinsEarned = 300;
      newStreak = 0;
    } else {
      coinsEarned = 10;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { coins: coinsEarned },
        $set: { streak: newStreak, lastActiveAt: today }
      },
      { new: true }
    );

    return {
      streak: newStreak,
      coinsEarned,
      totalCoins: updatedUser.coins
    };
  }

  return { streak: user.streak, coinsEarned: 0, totalCoins: user.coins };
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