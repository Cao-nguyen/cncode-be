const authService = require('./auth.service');
const affiliateService = require('../affiliate/affiliate.service');
const { isValidUsername, validateRequiredFields } = require('../../utils/validators');
const { buildUserResponse, getAdminUsers, emitNotification, emitUserUpdate } = require('../../utils/userHelpers');
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse } = require('../../utils/responseHelpers');

const getIO = (req) => req.app.get('io');

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return validationErrorResponse(res, 'Missing credential');
    }

    const payload = await authService.verifyGoogleToken(credential);
    const { user, isNewUser, bonusNotification } = await authService.findOrCreateUser(payload);
    const token = authService.generateToken(user._id, user.role);

    const io = getIO(req);
    const userId = user._id.toString();

    const referrerCode = req.cookies[affiliateService.REFERRAL_COOKIE_NAME];

    if (referrerCode && isNewUser) {
      const result = await affiliateService.trackRegistration(referrerCode, user);
    }

    if (bonusNotification) {
      io?.to(userId).emit('new_notification', bonusNotification);
      io?.to(userId).emit('coins_updated', {
        coins: user.coins,
        delta: 100,
        reason: 'first_login_bonus'
      });
    }

    successResponse(res, {
      user: buildUserResponse(user),
      token,
      isNewUser
    }, 'Login successful');
  } catch (error) {
    console.error('Google login error:', error);
    errorResponse(res, 'Internal server error');
  }
};

const checkUsername = async (req, res) => {
  try {
    const { username } = req.query;

    const validation = isValidUsername(username);
    if (!validation.valid) {
      return successResponse(res, { available: false }, validation.message);
    }

    const isAvailable = await authService.checkUsername(username);
    successResponse(res, {
      available: isAvailable
    }, isAvailable ? 'Username available' : 'Tên người dùng đã tồn tại');
  } catch (error) {
    console.error('Check username error:', error);
    errorResponse(res, 'Internal server error');
  }
};

const onboarding = async (req, res) => {
  try {
    const userId = req.userId;
    const { username, class: className, province, school, birthday, bio } = req.body;

    const validation = validateRequiredFields({ username, className, province, school, birthday }, ['username', 'className', 'province', 'school', 'birthday']);
    if (!validation.valid) {
      return validationErrorResponse(res, validation.message);
    }

    const user = await authService.updateOnboarding(userId, {
      username, class: className, province, school, birthday, bio: bio || ''
    });

    const io = getIO(req);
    const User = require('../user/user.model');
    const adminUsers = await getAdminUsers(User);
    adminUsers.forEach(admin => {
      io?.to(admin._id.toString()).emit('new_user_registered', {
        userId: user._id,
        userName: user.fullName,
        email: user.email
      });
    });

    successResponse(res, buildUserResponse(user), 'Onboarding completed successfully');
  } catch (error) {
    console.error('Onboarding error:', error);
    errorResponse(res, error.message || 'Internal server error');
  }
};

const getMe = async (req, res) => {
  const userId = req.userId;
  const user = await authService.getMe(userId);
  if (!user) {
    return notFoundResponse(res, 'User not found');
  }
  successResponse(res, buildUserResponse(user), 'Get user info successfully');
};

const updateStreak = async (req, res) => {
  try {
    const userId = req.userId;
    const result = await authService.updateStreak(userId);

    if (result && result.coinsEarned > 0) {
      const io = getIO(req);
      const userIdStr = userId.toString();

      emitUserUpdate(io, userIdStr, 'streak_updated', {
        streak: result.streak,
        coinsEarned: result.coinsEarned,
        totalCoins: result.totalCoins
      });

      emitUserUpdate(io, userIdStr, 'coins_updated', {
        coins: result.totalCoins,
        delta: result.coinsEarned,
        reason: 'streak_bonus'
      });

      if (result.bonusNotification) {
        emitNotification(io, userIdStr, result.bonusNotification);
      }
    }

    successResponse(res, result, 'Streak updated successfully');
  } catch (error) {
    console.error('Update streak error:', error);
    errorResponse(res, 'Internal server error');
  }
};

module.exports = {
  googleLogin,
  checkUsername,
  onboarding,
  getMe,
  updateStreak,
};
