const jwt = require('jsonwebtoken');
const User = require('../modules/user/user.model');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('fullName').lean();
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.userId = decoded.userId;
    req.userName = user.fullName;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.userId).select('fullName').lean();
      if (user) {
        req.userId = decoded.userId;
        req.userName = user.fullName;
      }
    }
  } catch {
  }
  next();
};

module.exports = { authenticate, optionalAuth };