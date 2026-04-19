// modules/user/user.controller.js
const User = require('./user.model');
const jwt = require('jsonwebtoken');

const getProfile = async (req, res) => {
    try {
        console.log('Getting profile for user:', req.userId); // Debug log
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            console.log('User not found:', req.userId);
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        console.log('User found:', user.email); // Debug log
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const updateData = req.body;

        // Các field được phép cập nhật
        const allowedFields = ['fullName', 'class', 'province', 'school', 'birthday', 'bio', 'username', 'avatar'];

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Kiểm tra username unique nếu có thay đổi
        if (updateData.username && updateData.username !== user.username) {
            const existingUser = await User.findOne({ username: updateData.username });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Tên người dùng đã tồn tại' });
            }
        }

        // Cập nhật các field
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                user[field] = updateData[field];
            }
        });

        await user.save();

        const updatedUser = await User.findById(userId).select('-password');
        res.json({ success: true, data: updatedUser, message: 'Cập nhật thông tin thành công' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const requestRoleChange = async (req, res) => {
    try {
        const { requestedRole } = req.body;

        if (requestedRole !== 'teacher') {
            return res.status(400).json({ success: false, message: 'Yêu cầu không hợp lệ' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.role === 'teacher') {
            return res.status(400).json({ success: false, message: 'Bạn đã là giáo viên' });
        }

        user.requestedRole = 'teacher';
        await user.save();

        // Gửi notification cho admin (có thể dùng socket)
        const io = req.app.get('io');
        if (io) {
            io.emit('role_request_notification', {
                userId: user._id,
                userName: user.fullName,
                requestedRole: 'teacher'
            });
        }

        res.json({ success: true, message: 'Đã gửi yêu cầu lên admin' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Không có file được upload' });
        }

        // Upload lên Cloudinary
        const cloudinary = require('cloudinary').v2;
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'avatars'
        });

        const user = await User.findById(req.userId);
        user.avatar = result.secure_url;
        await user.save();

        res.json({ success: true, data: { url: result.secure_url }, message: 'Upload avatar thành công' });
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    requestRoleChange,
    changePassword,
    uploadAvatar
};