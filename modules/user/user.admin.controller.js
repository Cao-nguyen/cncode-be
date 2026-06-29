const User = require('./user.model');
const Notification = require('../notification/notification.model');
const { isValidObjectId, validatePagination, validateSort } = require('../../utils/validators');
const { successResponse, errorResponse, notFoundResponse, validationErrorResponse, paginatedResponse } = require('../../utils/responseHelpers');
const { getAdminUsers, canDeleteUser, canChangeUserRole, cleanAffiliateData, emitNotification } = require('../../utils/userHelpers');

const getAllUsers = async (req, res) => {
  try {
    const { search = '', role = '', status = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const pagination = validatePagination(req.query);
    if (!pagination.valid) {
      return validationErrorResponse(res, pagination.message);
    }

    const sort = validateSort(req.query, ['createdAt', 'updatedAt', 'fullName', 'email', 'role']);
    if (!sort.valid) {
      return validationErrorResponse(res, sort.message);
    }

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
    sortOptions[sort.data.sortBy] = sort.data.sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .select('-password -violations')
      .sort(sortOptions)
      .limit(pagination.data.limit)
      .skip((pagination.data.page - 1) * pagination.data.limit);

    const total = await User.countDocuments(query);

    paginatedResponse(res, users, {
      page: pagination.data.page,
      limit: pagination.data.limit,
      total
    });
  } catch (error) {
    console.error('Get all users error:', error);
    errorResponse(res, error.message);
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return validationErrorResponse(res, 'ID người dùng không hợp lệ');
    }

    const user = await User.findById(id).select('-password -violations');
    if (!user) {
      return notFoundResponse(res, 'Không tìm thấy người dùng');
    }

    successResponse(res, user);
  } catch (error) {
    console.error('Get user by id error:', error);
    errorResponse(res, error.message);
  }
};

const updateUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, username, role, class: className, province, school, birthday, bio, coins, streak, isOnboarded } = req.body;

    if (!isValidObjectId(id)) {
      return validationErrorResponse(res, 'ID người dùng không hợp lệ');
    }

    const user = await User.findById(id);
    if (!user) {
      return notFoundResponse(res, 'Không tìm thấy người dùng');
    }

    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return validationErrorResponse(res, 'Email đã tồn tại');
      }
    }

    if (username && username !== user.username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return validationErrorResponse(res, 'Tên người dùng đã tồn tại');
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

    successResponse(res, user, 'Cập nhật người dùng thành công');
  } catch (error) {
    console.error('Update user by admin error:', error);
    errorResponse(res, error.message);
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return validationErrorResponse(res, 'ID người dùng không hợp lệ');
    }

    const user = await User.findById(id);
    if (!user) {
      return notFoundResponse(res, 'Không tìm thấy người dùng');
    }

    const canDelete = await canDeleteUser(User, id);
    if (!canDelete.canDelete) {
      return validationErrorResponse(res, canDelete.reason);
    }

    const userId = user._id.toString();

    const { AffiliateLink, AffiliateUser } = require('../affiliate/affiliate.model');
    const referrerId = await cleanAffiliateData(AffiliateLink, AffiliateUser, id);

    await user.deleteOne();

    const io = req.app.get('io');
    if (io) {
      io.emit('user_deleted', { userId: id, userName: user.fullName });
      io.to(userId).emit('force_logout', {
        message: 'Tài khoản của bạn đã bị xóa bởi quản trị viên',
        reason: 'account_deleted'
      });
      io.to(userId).emit('account_deleted', {
        message: 'Tài khoản của bạn đã bị xóa bởi quản trị viên'
      });

      if (referrerId) {
        io.to(referrerId).emit('affiliate_updated', {
          type: 'referred_user_deleted',
          targetName: user.fullName,
        });
      }
    }

    successResponse(res, null, 'Xóa người dùng thành công');
  } catch (error) {
    console.error('Delete user error:', error);
    errorResponse(res, error.message);
  }
};

const adjustUserCoins = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    if (!isValidObjectId(id)) {
      return validationErrorResponse(res, 'ID người dùng không hợp lệ');
    }

    if (amount === 0) {
      return validationErrorResponse(res, 'Số xu không hợp lệ');
    }

    const user = await User.findById(id);
    if (!user) {
      return notFoundResponse(res, 'Không tìm thấy người dùng');
    }

    const newCoins = user.coins + amount;
    if (newCoins < 0) {
      return validationErrorResponse(res, 'Số xu không thể âm');
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

      if (reason) {
        const action = amount > 0 ? `cộng ${amount}` : `trừ ${Math.abs(amount)}`;
        const notification = await Notification.create({
          userId: id,
          senderId: req.userId,
          type: 'system',
          content: `Quản trị viên đã ${action} xu. Lý do: ${reason}`,
          meta: { coins: amount }
        });

        emitNotification(io, id, notification);
      }
    }

    successResponse(res, { coins: user.coins }, `Đã ${amount > 0 ? 'cộng' : 'trừ'} ${Math.abs(amount)} xu ${reason ? `(Lý do: ${reason})` : ''}`);
  } catch (error) {
    console.error('Adjust user coins error:', error);
    errorResponse(res, error.message);
  }
};

const approveTeacherRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;

    if (!isValidObjectId(id)) {
      return validationErrorResponse(res, 'ID người dùng không hợp lệ');
    }

    const user = await User.findById(id);
    if (!user) {
      return notFoundResponse(res, 'Không tìm thấy người dùng');
    }

    if (user.requestedRole !== 'teacher') {
      return validationErrorResponse(res, 'Người dùng không có yêu cầu lên giáo viên');
    }

    const admin = await User.findById(req.userId).select('fullName');
    const adminName = admin?.fullName || 'Quản trị viên';

    const oldRole = user.role;

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
      emitNotification(io, user._id, newNotification);

      if (approved) {
        io.to(user._id.toString()).emit('role_changed', {
          userId: user._id.toString(),
          newRole: 'teacher',
          oldRole,
        });
      }

      io.to(user._id.toString()).emit('role_request_resolved', {
        approved,
        newRole: approved ? 'teacher' : oldRole,
      });
    }

    successResponse(res, { role: user.role }, approved ? 'Đã duyệt yêu cầu lên giáo viên' : 'Đã từ chối yêu cầu lên giáo viên');
  } catch (error) {
    console.error('Approve teacher request error:', error);
    errorResponse(res, error.message);
  }
};

const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!isValidObjectId(id)) {
      return validationErrorResponse(res, 'ID người dùng không hợp lệ');
    }

    if (!['user', 'teacher', 'admin'].includes(role)) {
      return validationErrorResponse(res, 'Vai trò không hợp lệ');
    }

    const canChange = await canChangeUserRole(User, id, role);
    if (!canChange.canChange) {
      return validationErrorResponse(res, canChange.reason);
    }

    const user = await User.findById(id);
    if (!user) {
      return notFoundResponse(res, 'Không tìm thấy người dùng');
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
      emitNotification(io, user._id, newNotification);

      io.to(user._id.toString()).emit('role_changed', { newRole: role });

      io.to(user._id.toString()).emit('role_request_resolved', {
        approved: role === 'teacher',
        newRole: role,
      });

      const allAdmins = await getAdminUsers(User);
      allAdmins.forEach(adminUser => {
        io.to(adminUser._id.toString()).emit('user_role_changed', {
          userId: user._id,
          userName: user.fullName,
          oldRole,
          newRole: role
        });
      });
    }

    successResponse(res, user, `Đã chuyển vai trò thành ${roleLabels[role] || role}`);
  } catch (error) {
    console.error('Change user role error:', error);
    errorResponse(res, error.message);
  }
};

const getUserStats = async (req, res) => {
  try {
    const [totalUsers, totalTeachers, totalAdmins, pendingTeachers, newThisWeek, activeToday] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ requestedRole: 'teacher' }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      User.countDocuments({ lastActiveAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } })
    ]);

    successResponse(res, { total: totalUsers, teachers: totalTeachers, admins: totalAdmins, pendingTeachers, newThisWeek, activeToday });
  } catch (error) {
    console.error('Get user stats error:', error);
    errorResponse(res, error.message);
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

    successResponse(res, { stats: provinceStats, totalWithProvince, totalWithoutProvince, totalUsers: totalWithProvince + totalWithoutProvince });
  } catch (error) {
    console.error('Get user stats by province error:', error);
    errorResponse(res, error.message);
  }
};

const getPendingTeachers = async (req, res) => {
  try {
    const pendingTeachers = await User.find({
      requestedRole: 'teacher',
      role: 'user'
    }).select('-password -violations').sort({ createdAt: -1 });

    successResponse(res, pendingTeachers);
  } catch (error) {
    console.error('Get pending teachers error:', error);
    errorResponse(res, error.message);
  }
};

const markViolation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, action } = req.body;

    if (!isValidObjectId(id)) {
      return validationErrorResponse(res, 'ID người dùng không hợp lệ');
    }

    if (!reason || !['warn', 'mute', 'ban'].includes(action)) {
      return validationErrorResponse(res, 'Thông tin vi phạm không hợp lệ');
    }

    const user = await User.findById(id);
    if (!user) {
      return notFoundResponse(res, 'Không tìm thấy người dùng');
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

    successResponse(res, user, `Đã ${action === 'ban' ? 'khóa' : action === 'mute' ? 'cấm chat' : 'cảnh cáo'} người dùng`);
  } catch (error) {
    console.error('Mark violation error:', error);
    errorResponse(res, error.message);
  }
};

const removeViolation = async (req, res) => {
  try {
    const { id, violationId } = req.params;

    if (!isValidObjectId(id) || !isValidObjectId(violationId)) {
      return validationErrorResponse(res, 'ID không hợp lệ');
    }

    const user = await User.findById(id);
    if (!user) {
      return notFoundResponse(res, 'Không tìm thấy người dùng');
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
    successResponse(res, user, 'Đã xóa vi phạm');
  } catch (error) {
    console.error('Remove violation error:', error);
    errorResponse(res, error.message);
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

    successResponse(res, users);
  } catch (error) {
    console.error('Get violated users error:', error);
    errorResponse(res, error.message);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserByAdmin,
  deleteUser,
  adjustUserCoins,
  approveTeacherRequest,
  changeUserRole,
  getUserStats,
  getUserStatsByProvince,
  getPendingTeachers,
  markViolation,
  removeViolation,
  getViolatedUsers,
};
