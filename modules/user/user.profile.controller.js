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
      const existingUser = await User.findOne({ username: updateData.username });
      if (existingUser) {
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

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
};
