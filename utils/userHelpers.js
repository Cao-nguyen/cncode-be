const buildUserResponse = (user) => {
  return {
    _id: user._id,
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
};

/**
 * Build minimal user response (for notifications, etc.)
 */
const buildMinimalUserResponse = (user) => {
  return {
    _id: user._id,
    fullName: user.fullName,
    username: user.username,
    avatar: user.avatar,
    role: user.role
  };
};

/**
 * Get admin users for notifications
 */
const getAdminUsers = async (User) => {
  return await User.find({ role: 'admin' }).select('_id fullName email');
};

/**
 * Check if user can be deleted (not the last admin)
 */
const canDeleteUser = async (User, userId) => {
  const user = await User.findById(userId);
  if (!user) return { canDelete: false, reason: 'User not found' };
  
  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      return { canDelete: false, reason: 'Không thể xóa admin cuối cùng' };
    }
  }
  
  return { canDelete: true };
};

/**
 * Check if user can change role (not degrading last admin)
 */
const canChangeUserRole = async (User, userId, newRole) => {
  const user = await User.findById(userId);
  if (!user) return { canChange: false, reason: 'User not found' };
  
  if (user.role === 'admin' && newRole !== 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      return { canChange: false, reason: 'Không thể hạ cấp admin cuối cùng' };
    }
  }
  
  return { canChange: true };
};

/**
 * Clean affiliate data when user is deleted
 */
const cleanAffiliateData = async (AffiliateLink, AffiliateUser, userId) => {
  const affiliateAsTarget = await AffiliateUser.findOne({ targetUserId: userId });
  const referrerId = affiliateAsTarget?.affiliateUserId?.toString();
  
  await AffiliateLink.deleteOne({ userId });
  await AffiliateUser.deleteMany({ affiliateUserId: userId });
  await AffiliateUser.deleteMany({ targetUserId: userId });
  
  return referrerId;
};

/**
 * Emit socket events for user updates
 */
const emitUserUpdate = (io, userId, eventType, data) => {
  if (!io) return;
  
  const userIdStr = userId.toString();
  io.to(userIdStr).emit(eventType, data);
};

/**
 * Emit notification to user
 */
const emitNotification = async (io, userId, notification) => {
  if (!io) return;
  
  io.to(userId.toString()).emit('new_notification', {
    _id: notification._id,
    notificationId: notification._id.toString(),
    userId: notification.userId,
    type: notification.type,
    content: notification.content,
    meta: notification.meta,
    read: false,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  });
};

module.exports = {
  buildUserResponse,
  buildMinimalUserResponse,
  getAdminUsers,
  canDeleteUser,
  canChangeUserRole,
  cleanAffiliateData,
  emitUserUpdate,
  emitNotification,
};
