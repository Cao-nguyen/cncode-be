// modules/user/user.controller.js
const Notification = require('../notification/notification.model');
const User = require('./user.model');
const mongoose = require('mongoose');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password -violations');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
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
        const allowedFields = ['fullName', 'class', 'province', 'school', 'birthday', 'bio', 'username', 'avatar'];

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (updateData.username && updateData.username !== user.username) {
            const existingUser = await User.findOne({ username: updateData.username });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Tên người dùng đã tồn tại' });
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
        if (io) {
            io.to(userId.toString()).emit('profile_updated', { user: updatedUser });
        }

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

        const io = req.app.get('io');
        if (io) {
            const adminUsers = await User.find({ role: 'admin' }).select('_id');
            adminUsers.forEach(admin => {
                io.to(admin._id.toString()).emit('role_request_notification', {
                    userId: user._id,
                    userName: user.fullName,
                    requestedRole: 'teacher'
                });
            });
        }

        res.json({ success: true, message: 'Đã gửi yêu cầu lên admin' });
    } catch (error) {
        console.error('Request role error:', error);
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
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Không có file được upload' });
        }

        const cloudinary = require('cloudinary').v2;
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'avatars'
        });

        const user = await User.findById(req.userId);
        user.avatar = result.secure_url;
        await user.save();

        const io = req.app.get('io');
        if (io) {
            io.to(req.userId.toString()).emit('avatar_updated', { avatar: result.secure_url });
        }

        res.json({ success: true, data: { url: result.secure_url }, message: 'Upload avatar thành công' });
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            role = '',
            status = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const query = {};

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ];
        }

        if (role) query.role = role;

        if (status === 'active') {
            query.lastActiveAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        } else if (status === 'inactive') {
            query.lastActiveAt = { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const users = await User.find(query)
            .select('-password -violations')
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
        }

        const user = await User.findById(id).select('-password -violations');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error('Get user by id error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, email, username, role, class: className, province, school, birthday, bio, coins, streak, isOnboarded } = req.body;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        if (email && email !== user.email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
            }
        }

        if (username && username !== user.username) {
            const existingUsername = await User.findOne({ username });
            if (existingUsername) {
                return res.status(400).json({ success: false, message: 'Tên người dùng đã tồn tại' });
            }
        }

        if (fullName) user.fullName = fullName;
        if (email) user.email = email;
        if (username) user.username = username;
        if (role) user.role = role;
        if (className !== undefined) user.class = className;
        if (province !== undefined) user.province = province;
        if (school !== undefined) user.school = school;
        if (birthday) user.birthday = birthday;
        if (bio !== undefined) user.bio = bio;
        if (coins !== undefined) user.coins = coins;
        if (streak !== undefined) user.streak = streak;
        if (isOnboarded !== undefined) user.isOnboarded = isOnboarded;

        await user.save();

        res.status(200).json({
            success: true,
            data: user,
            message: 'Cập nhật người dùng thành công'
        });
    } catch (error) {
        console.error('Update user by admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        if (user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ success: false, message: 'Không thể xóa tài khoản admin cuối cùng' });
            }
        }

        const userId = user._id.toString();
        const userEmail = user.email;
        const userName = user.fullName;

        await user.deleteOne();

        const io = req.app.get('io');
        if (io) {
            // Emit cho admin để cập nhật danh sách
            io.emit('user_deleted', { userId: id, userName: user.fullName });

            // Emit riêng cho user bị xóa để logout
            io.to(userId).emit('account_deleted', {
                message: 'Tài khoản của bạn đã bị xóa bởi quản trị viên'
            });
        }

        res.status(200).json({ success: true, message: 'Xóa người dùng thành công' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const adjustUserCoins = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, reason } = req.body;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
        }

        if (amount === 0) {
            return res.status(400).json({ success: false, message: 'Số xu không hợp lệ' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        const newCoins = user.coins + amount;
        if (newCoins < 0) {
            return res.status(400).json({ success: false, message: 'Số xu không thể âm' });
        }

        user.coins = newCoins;
        await user.save();

        const io = req.app.get('io');
        if (io) {
            io.to(id.toString()).emit('coins_updated', {
                userId: id,
                coins: user.coins,
                amount: amount
            });
        }

        res.status(200).json({
            success: true,
            data: { coins: user.coins },
            message: `Đã ${amount > 0 ? 'cộng' : 'trừ'} ${Math.abs(amount)} xu ${reason ? `(Lý do: ${reason})` : ''}`
        });
    } catch (error) {
        console.error('Adjust user coins error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const approveTeacherRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { approved } = req.body;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        if (user.requestedRole !== 'teacher') {
            return res.status(400).json({ success: false, message: 'Người dùng không có yêu cầu lên giáo viên' });
        }

        const admin = await User.findById(req.userId).select('fullName');
        const adminName = admin?.fullName || 'Quản trị viên';

        if (approved) {
            user.role = 'teacher';
            user.requestedRole = null;
        } else {
            user.requestedRole = null;
        }

        await user.save();

        const newNotification = await Notification.create({
            userId: user._id,
            senderId: req.userId,
            type: approved ? 'role_request_approved' : 'role_request_rejected',
            content: approved
                ? `Quản trị viên ${adminName} đã phê duyệt yêu cầu quyền giáo viên của bạn.`
                : `Quản trị viên ${adminName} đã từ chối yêu cầu quyền giáo viên của bạn.`,
            meta: { approved }
        });

        const io = req.app.get('io');
        if (io) {
            io.to(user._id.toString()).emit('new_notification', {
                _id: newNotification._id,
                notificationId: newNotification._id.toString(),
                userId: user._id,
                type: newNotification.type,
                content: newNotification.content,
                meta: { approved },
                read: false,
                createdAt: newNotification.createdAt,
                updatedAt: newNotification.updatedAt,
            });

            io.to(user._id.toString()).emit('role_changed', { newRole: user.role });
        }

        res.status(200).json({
            success: true,
            data: { role: user.role },
            message: approved ? 'Đã duyệt yêu cầu lên giáo viên' : 'Đã từ chối yêu cầu lên giáo viên'
        });
    } catch (error) {
        console.error('Approve teacher request error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const changeUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
        }

        if (!['user', 'teacher', 'admin'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        if (user.role === 'admin' && role !== 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ success: false, message: 'Không thể hạ cấp admin cuối cùng' });
            }
        }

        const oldRole = user.role;
        user.role = role;
        user.requestedRole = null;
        await user.save();

        const admin = await User.findById(req.userId).select('fullName');
        const adminName = admin?.fullName || 'Quản trị viên';

        const roleLabels = { user: 'Người dùng', teacher: 'Giáo viên', admin: 'Admin' };

        const newNotification = await Notification.create({
            userId: user._id,
            senderId: req.userId,
            type: 'system',
            content: `Quản trị viên ${adminName} đã thay đổi vai trò của bạn từ ${roleLabels[oldRole] || oldRole} thành ${roleLabels[role] || role}.`,
            meta: { oldRole, newRole: role }
        });

        const io = req.app.get('io');
        if (io) {
            io.to(user._id.toString()).emit('new_notification', {
                _id: newNotification._id,
                notificationId: newNotification._id.toString(),
                userId: user._id,
                type: 'system',
                content: newNotification.content,
                meta: { oldRole, newRole: role },
                read: false,
                createdAt: newNotification.createdAt,
                updatedAt: newNotification.updatedAt,
            });

            io.to(user._id.toString()).emit('role_changed', { newRole: role });

            const allAdmins = await User.find({ role: 'admin' }).select('_id');
            allAdmins.forEach(adminUser => {
                io.to(adminUser._id.toString()).emit('user_role_changed', {
                    userId: user._id,
                    userName: user.fullName,
                    oldRole,
                    newRole: role
                });
            });
        }

        res.status(200).json({
            success: true,
            data: user,
            message: `Đã chuyển vai trò thành ${roleLabels[role] || role}`
        });
    } catch (error) {
        console.error('Change user role error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getUserStats = async (req, res) => {
    try {
        const [totalUsers, totalTeachers, totalAdmins, pendingTeachers, newThisWeek, activeToday] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'teacher' }),
            User.countDocuments({ role: 'admin' }),
            User.countDocuments({ requestedRole: 'teacher' }),
            User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
            User.countDocuments({ lastActiveAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } })
        ]);

        res.status(200).json({
            success: true,
            data: { total: totalUsers, teachers: totalTeachers, admins: totalAdmins, pendingTeachers, newThisWeek, activeToday }
        });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getUserStatsByProvince = async (req, res) => {
    try {
        const provinceStats = await User.aggregate([
            { $match: { province: { $ne: null, $ne: "" } } },
            { $group: { _id: "$province", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const totalWithProvince = provinceStats.reduce((sum, item) => sum + item.count, 0);
        const totalWithoutProvince = await User.countDocuments({
            $or: [{ province: null }, { province: "" }]
        });

        res.status(200).json({
            success: true,
            data: { stats: provinceStats, totalWithProvince, totalWithoutProvince, totalUsers: totalWithProvince + totalWithoutProvince }
        });
    } catch (error) {
        console.error('Get user stats by province error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getPendingTeachers = async (req, res) => {
    try {
        const pendingTeachers = await User.find({
            requestedRole: 'teacher',
            role: 'user'
        }).select('-password -violations').sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: pendingTeachers });
    } catch (error) {
        console.error('Get pending teachers error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const markViolation = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, action } = req.body;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
        }

        if (!reason || !['warn', 'mute', 'ban'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Thông tin vi phạm không hợp lệ' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        const violation = { reason, action, adminId: req.userId, createdAt: new Date() };
        user.violations = user.violations || [];
        user.violations.push(violation);

        if (action === 'ban') {
            user.isBanned = true;
            user.bannedAt = new Date();
            user.banReason = reason;
        } else if (action === 'mute') {
            user.isMuted = true;
            user.mutedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }

        await user.save();

        const io = req.app.get('io');
        if (io) {
            io.to(id.toString()).emit('user_violated', {
                userId: id,
                userName: user.fullName,
                action,
                reason
            });
        }

        res.status(200).json({
            success: true,
            data: user,
            message: `Đã ${action === 'ban' ? 'khóa' : action === 'mute' ? 'cấm chat' : 'cảnh cáo'} người dùng`
        });
    } catch (error) {
        console.error('Mark violation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const removeViolation = async (req, res) => {
    try {
        const { id, violationId } = req.params;

        if (!isValidObjectId(id) || !isValidObjectId(violationId)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        user.violations = user.violations.filter(v => v._id.toString() !== violationId);

        if (user.violations.length === 0) {
            user.isBanned = false;
            user.isMuted = false;
            user.bannedAt = null;
            user.banReason = null;
            user.mutedUntil = null;
        }

        await user.save();
        res.status(200).json({ success: true, data: user, message: 'Đã xóa vi phạm' });
    } catch (error) {
        console.error('Remove violation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getViolatedUsers = async (req, res) => {
    try {
        const users = await User.find({
            $or: [
                { isBanned: true },
                { isMuted: true },
                { violations: { $exists: true, $ne: [] } }
            ]
        }).select('-password').sort({ 'violations.createdAt': -1 });

        res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error('Get violated users error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteOwnAccount = async (req, res) => {
    try {
        const userId = req.userId;

        if (!isValidObjectId(userId)) {
            return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        if (user.role === 'admin') {
            return res.status(403).json({ success: false, message: 'Admin không thể tự xóa tài khoản qua đây' });
        }

        await user.deleteOne();

        const io = req.app.get('io');
        if (io) {
            io.emit('user_account_deleted', { userId, email: user.email });
        }

        res.status(200).json({ success: true, message: 'Tài khoản đã được xóa vĩnh viễn' });
    } catch (error) {
        console.error('Delete own account error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    requestRoleChange,
    changePassword,
    uploadAvatar,
    getAllUsers,
    getUserById,
    updateUserByAdmin,
    deleteUser,
    adjustUserCoins,
    approveTeacherRequest,
    getUserStats,
    getUserStatsByProvince,
    getPendingTeachers,
    markViolation,
    removeViolation,
    changeUserRole,
    getViolatedUsers,
    deleteOwnAccount
};