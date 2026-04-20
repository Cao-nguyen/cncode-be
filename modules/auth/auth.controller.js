const authService = require('./auth.service');

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Missing credential'
      });
    }

    const payload = await authService.verifyGoogleToken(credential);
    const { user, isNewUser } = await authService.findOrCreateUser(payload);
    const token = authService.generateToken(user._id);

    const userResponse = {
      id: user._id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      role: user.role,
      isOnboarded: user.isOnboarded,
      class: user.class,
      province: user.province,
      school: user.school,
      birthday: user.birthday,
      bio: user.bio,
      coins: user.coins,
      streak: user.streak,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(200).json({
      success: true,
      data: {
        user: userResponse,
        token,
        isNewUser
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const checkUsername = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || username.trim() === '') {
      return res.status(200).json({
        available: false,
        message: 'Tên người dùng không được để trống'
      });
    }

    if (username.length < 3) {
      return res.status(200).json({
        available: false,
        message: 'Tên người dùng phải có ít nhất 3 ký tự'
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(200).json({
        available: false,
        message: 'Tên người dùng chỉ bao gồm chữ cái, số và dấu gạch dưới'
      });
    }

    const isAvailable = await authService.checkUsername(username);

    res.status(200).json({
      available: isAvailable,
      message: isAvailable ? 'Username available' : 'Tên người dùng đã tồn tại'
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const onboarding = async (req, res) => {
  try {
    const userId = req.userId;
    const { username, class: className, province, school, birthday, bio } = req.body;

    if (!username || !className || !province || !school || !birthday) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc'
      });
    }

    const user = await authService.updateOnboarding(userId, {
      username,
      class: className,
      province,
      school,
      birthday,
      bio: bio || ''
    });

    const userResponse = {
      id: user._id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      role: user.role,
      isOnboarded: user.isOnboarded,
      class: user.class,
      province: user.province,
      school: user.school,
      birthday: user.birthday,
      bio: user.bio,
      coins: user.coins,
      streak: user.streak,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(200).json({
      success: true,
      data: userResponse,
      message: 'Onboarding completed successfully'
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await authService.getMe(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Chuyển đổi user thành object plain
    const userObject = user.toObject ? user.toObject() : user;

    // Đảm bảo coins ở root level
    userObject.coins = userObject.coins || userObject._doc?.coins || 0;

    res.status(200).json({
      success: true,
      data: userObject,
      message: 'Get user info successfully'
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const updateStreak = async (req, res) => {
  try {
    const userId = req.userId;
    const result = await authService.updateStreak(userId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Streak updated successfully'
    });
  } catch (error) {
    console.error('Update streak error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  googleLogin,
  checkUsername,
  onboarding,
  getMe,
  updateStreak
};