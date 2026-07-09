const User = require('./user.model');
const { isValidObjectId } = require('../../utils/validators');
const { successResponse, errorResponse, notFoundResponse, validationErrorResponse, forbiddenResponse } = require('../../utils/responseHelpers');
const { getAdminUsers, cleanAffiliateData, emitNotification } = require('../../utils/userHelpers');
const Notification = require('../notification/notification.model');

const requestRoleChange = async (req, res) => {
  try {
    const { teacherName, teacherWorkUnit } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return notFoundResponse(res, 'User not found');
    }

    if (user.role === 'teacher') {
      return validationErrorResponse(res, 'Bạn đã là giáo viên');
    }

    if (user.requestedRole === 'teacher') {
      return validationErrorResponse(res, 'Yêu cầu của bạn đã được gửi, vui lòng chờ duyệt');
    }

    user.requestedRole = 'teacher';

    if (teacherName) user.teacherName = teacherName;
    if (teacherWorkUnit) user.teacherWorkUnit = teacherWorkUnit;

    await user.save();

    const io = req.app.get('io');
    if (io) {
      const adminUsers = await getAdminUsers(User);
      adminUsers.forEach(admin => {
        io.to(admin._id.toString()).emit('role_request_notification', {
          userId: user._id,
          userName: user.fullName,
          teacherName: teacherName || user.fullName,
          teacherWorkUnit: teacherWorkUnit || '',
          requestedRole: 'teacher'
        });
      });
    }

    successResponse(res, null, 'Đã gửi yêu cầu lên admin');
  } catch (error) {
    console.error('Request role error:', error);
    errorResponse(res, error.message);
  }
};

const deleteOwnAccount = async (req, res) => {
  try {
    const userId = req.userId;

    if (!isValidObjectId(userId)) {
      return validationErrorResponse(res, 'ID người dùng không hợp lệ');
    }

    const user = await User.findById(userId);
    if (!user) {
      return notFoundResponse(res, 'Không tìm thấy người dùng');
    }

    if (user.role === 'admin') {
      return forbiddenResponse(res, 'Admin không thể tự xóa tài khoản qua đây');
    }

    const { AffiliateLink, AffiliateUser } = require('../affiliate/affiliate.model');
    const referrerId = await cleanAffiliateData(AffiliateLink, AffiliateUser, userId);

    await user.deleteOne();

    const io = req.app.get('io');
    if (io) {
      io.emit('user_account_deleted', { userId, email: user.email });

      if (referrerId) {
        io.to(referrerId).emit('affiliate_updated', {
          type: 'referred_user_deleted',
          targetName: user.fullName,
        });
      }
    }

    successResponse(res, null, 'Tài khoản đã được xóa vĩnh viễn');
  } catch (error) {
    console.error('Delete own account error:', error);
    errorResponse(res, error.message);
  }
};

const getLoveUser = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    successResponse(res, {
      totalUsers: totalUsers,
      targetUsers: 5000,
      percentage: Math.min((totalUsers / 5000) * 100, 100)
    });
  } catch (error) {
    console.error('Get total users error:', error);
    errorResponse(res, error.message);
  }
};

const exportUsersToExcel = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    const exceljs = require('exceljs');

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Users');

    worksheet.columns = [
      { header: 'Họ và tên', key: 'fullName', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Lớp', key: 'class', width: 15 },
      { header: 'Trường học', key: 'school', width: 25 },
      { header: 'Tỉnh thành', key: 'province', width: 20 },
      { header: 'Role', key: 'role', width: 15 },
    ];

    users.forEach(user => {
      worksheet.addRow({
        fullName: user.fullName,
        email: user.email,
        class: user.class,
        school: user.school,
        province: user.province,
        role: user.role,
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' + 'users.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting users to Excel:', error);
    errorResponse(res, 'Error exporting users to Excel');
  }
};

const incrementStreak = async (req, res) => {
  try {
    const userId = req.userId;

    if (!isValidObjectId(userId)) {
      return validationErrorResponse(res, 'ID người dùng không hợp lệ');
    }

    const user = await User.findById(userId);
    if (!user) {
      return notFoundResponse(res, 'Không tìm thấy người dùng');
    }

    // Check if user already completed streak today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastStreakDate = user.lastStreakDate ? new Date(user.lastStreakDate) : null;
    if (lastStreakDate) {
      lastStreakDate.setHours(0, 0, 0, 0);
    }

    // If already completed today, don't increment
    if (lastStreakDate && lastStreakDate.getTime() === today.getTime()) {
      return successResponse(res, {
        streak: user.streak,
        coins: user.coins,
        alreadyCompleted: true
      }, 'Bạn đã hoàn thành streak hôm nay');
    }

    // Increment streak and coins
    user.streak = (user.streak || 0) + 1;
    user.coins = (user.coins || 0) + 1; // +1 coin as reward
    user.lastStreakDate = new Date();
    await user.save();

    // Emit socket event for realtime update
    const io = req.app.get('io');
    if (io) {
      io.to(userId.toString()).emit('streak_updated', {
        userId: userId.toString(),
        streak: user.streak,
        totalCoins: user.coins
      });
    }

    successResponse(res, {
      streak: user.streak,
      coins: user.coins,
      alreadyCompleted: false
    }, 'Streak updated successfully');
  } catch (error) {
    console.error('Increment streak error:', error);
    errorResponse(res, error.message);
  }
};

module.exports = {
  requestRoleChange,
  deleteOwnAccount,
  getLoveUser,
  exportUsersToExcel,
  incrementStreak,
};
