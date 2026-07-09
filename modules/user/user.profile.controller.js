const User = require('./user.model');
const { isValidObjectId } = require('../../utils/validators');
const { successResponse, errorResponse, notFoundResponse, validationErrorResponse } = require('../../utils/responseHelpers');
const { emitUserUpdate } = require('../../utils/userHelpers');

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -violations');
    if (!user) {
      return notFoundResponse(res, 'User not found');
    }
    successResponse(res, user);
  } catch (error) {
    console.error('Get profile error:', error);
    errorResponse(res, error.message);
  }
};

const getProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select('-password -violations');
    if (!user) {
      return notFoundResponse(res, 'User not found');
    }
    successResponse(res, user);
  } catch (error) {
    console.error('Get profile by username error:', error);
    errorResponse(res, error.message);
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const updateData = req.body;
    const allowedFields = ['fullName', 'class', 'province', 'school', 'birthday', 'bio', 'username', 'avatar', 'socialLinks'];

    const user = await User.findById(userId);
    if (!user) {
      return notFoundResponse(res, 'User not found');
    }

    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${updateData.username}$`), $options: 'i' } });
      if (existingUser && existingUser._id.toString() !== userId) {
        return validationErrorResponse(res, 'Tên người dùng đã tồn tại');
      }
    }

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        user[field] = updateData[field];
      }
    });

    await user.save();
    const updatedUser = await User.findById(userId).select('-password -violations');

    const io = req.app.get('io');
    emitUserUpdate(io, userId, 'profile_updated', { user: updatedUser });

    successResponse(res, updatedUser, 'Cập nhật thông tin thành công');
  } catch (error) {
    console.error('Update profile error:', error);
    errorResponse(res, error.message);
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return validationErrorResponse(res, 'Vui lòng nhập đầy đủ thông tin');
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return notFoundResponse(res, 'User not found');
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return validationErrorResponse(res, 'Mật khẩu hiện tại không đúng');
    }

    user.password = newPassword;
    await user.save();
    successResponse(res, null, 'Đổi mật khẩu thành công');
  } catch (error) {
    console.error('Change password error:', error);
    errorResponse(res, error.message);
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return validationErrorResponse(res, 'Không có file được upload');
    }

    const cloudinary = require('cloudinary').v2;
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'avatars'
    });

    const user = await User.findById(req.userId);
    user.avatar = result.secure_url;
    await user.save();

    const io = req.app.get('io');
    emitUserUpdate(io, req.userId, 'avatar_updated', { avatar: result.secure_url });

    successResponse(res, { url: result.secure_url }, 'Upload avatar thành công');
  } catch (error) {
    console.error('Upload avatar error:', error);
    errorResponse(res, error.message);
  }
};

const followUser = async (req, res) => {
  try {
    const userId = req.userId;
    const { targetUserId } = req.params;

    if (userId === targetUserId) {
      return validationErrorResponse(res, 'Không thể tự theo dõi bản thân');
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetUserId)
    ]);

    if (!currentUser || !targetUser) {
      return notFoundResponse(res, 'Người dùng không tồn tại');
    }

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(id => id.toString() !== targetUserId);
      targetUser.followers = targetUser.followers.filter(id => id.toString() !== userId);
    } else {
      // Follow
      currentUser.following.push(targetUserId);
      targetUser.followers.push(userId);
    }

    await Promise.all([currentUser.save(), targetUser.save()]);

    const io = req.app.get('io');
    emitUserUpdate(io, targetUserId, 'follower_updated', {
      followerCount: targetUser.followers.length
    });

    successResponse(res, {
      isFollowing: !isFollowing,
      followerCount: targetUser.followers.length,
      followingCount: currentUser.following.length
    }, isFollowing ? 'Đã bỏ theo dõi' : 'Đã theo dõi');
  } catch (error) {
    console.error('Follow user error:', error);
    errorResponse(res, error.message);
  }
};

const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate('followers', 'fullName username avatar role');

    if (!user) {
      return notFoundResponse(res, 'Người dùng không tồn tại');
    }

    successResponse(res, user.followers);
  } catch (error) {
    console.error('Get followers error:', error);
    errorResponse(res, error.message);
  }
};

const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate('following', 'fullName username avatar role');

    if (!user) {
      return notFoundResponse(res, 'Người dùng không tồn tại');
    }

    successResponse(res, user.following);
  } catch (error) {
    console.error('Get following error:', error);
    errorResponse(res, error.message);
  }
};

const searchUsers = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || username.trim().length === 0) {
      return validationErrorResponse(res, 'Username query is required');
    }

    // Search users by username (case insensitive, partial match)
    const users = await User.find({
      username: { $regex: username.trim(), $options: 'i' }
    })
      .select('_id fullName username email avatar role')
      .limit(20);

    successResponse(res, users);
  } catch (error) {
    console.error('Search users error:', error);
    errorResponse(res, error.message);
  }
};

module.exports = {
  getProfile,
  getProfileByUsername,
  updateProfile,
  changePassword,
  uploadAvatar,
  followUser,
  getFollowers,
  getFollowing,
  searchUsers,
};
