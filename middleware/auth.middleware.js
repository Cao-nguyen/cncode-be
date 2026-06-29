const jwt = require('jsonwebtoken');
const User = require('../modules/user/user.model');

const adminAuth = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await User.findById(req.userId);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const authenticate = async (req, res, next) => {
  try {
    console.log('🔐 [AUTH] === START ===');
    console.log('🔐 [AUTH] Headers:', JSON.stringify(req.headers, null, 2));

    const authHeader = req.headers.authorization;
    console.log('🔐 [AUTH] Authorization header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [AUTH] No token provided');
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log('📝 [AUTH] Token (first 50 chars):', token.substring(0, 50) + '...');

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ [AUTH] Decoded successfully:', JSON.stringify(decoded, null, 2));
    } catch (err) {
      console.error('❌ [AUTH] JWT verify error:', err.message);
      return res.status(401).json({ success: false, message: 'Invalid token: ' + err.message });
    }

    const userId = decoded.userId || decoded.id || decoded._id;
    console.log('👤 [AUTH] Extracted userId:', userId);

    if (!userId) {
      console.log('❌ [AUTH] No userId in token');
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    const user = await User.findById(userId).select('fullName role').lean();
    console.log('👤 [AUTH] User found:', user ? user.fullName : 'NOT FOUND');
    console.log('👤 [AUTH] User role:', user ? user.role : 'N/A');

    if (!user) {
      console.log('❌ [AUTH] User not found');
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.userId = userId;
    req.userName = user.fullName;
    req.userRole = user.role || 'user';
    console.log('✅ [AUTH] Success! userId:', req.userId, 'role:', req.userRole);
    console.log('🔐 [AUTH] === END ===');

    next();
  } catch (error) {
    console.error('❌ [AUTH] Unexpected error:', error);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.userId).select('fullName role').lean();
      if (user) {
        req.userId = decoded.userId;
        req.userName = user.fullName;
        req.userRole = user.role || 'user';
      }
    }
  } catch (error) { }
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('🔐 [AUTHORIZE] Required roles:', roles);
    console.log('🔐 [AUTHORIZE] User role:', req.userRole);
    console.log('🔐 [AUTHORIZE] User ID:', req.userId);

    if (!req.userRole) {
      console.log('❌ [AUTHORIZE] No user role found');
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập'
      });
    }

    if (!roles.includes(req.userRole)) {
      console.log('❌ [AUTHORIZE] Role not authorized. Required:', roles, 'Got:', req.userRole);
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập'
      });
    }

    console.log('✅ [AUTHORIZE] Access granted');
    next();
  };
};

// Require admin role
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ success: false, message: 'Yêu cầu quyền admin' });
  }
  next();
};

module.exports = { authenticate, optionalAuth, authorize, adminAuth, requireAdmin };
