const mongoose = require('mongoose');

/**
 * Kiểm tra ObjectId hợp lệ
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validate email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate username
 */
const isValidUsername = (username) => {
  if (!username || username.trim() === '') {
    return { valid: false, message: 'Tên người dùng không được để trống' };
  }
  if (username.length < 3) {
    return { valid: false, message: 'Tên người dùng phải có ít nhất 3 ký tự' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: 'Tên người dùng chỉ bao gồm chữ cái, số và dấu gạch dưới' };
  }
  return { valid: true };
};

/**
 * Validate password
 */
const isValidPassword = (password) => {
  if (!password || password.length < 6) {
    return { valid: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' };
  }
  return { valid: true };
};

/**
 * Validate required fields
 */
const validateRequiredFields = (data, requiredFields) => {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    return {
      valid: false,
      message: `Thiếu các trường bắt buộc: ${missing.join(', ')}`
    };
  }
  
  return { valid: true };
};

/**
 * Validate pagination params
 */
const validatePagination = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  
  if (page < 1) {
    return { valid: false, message: 'Page phải lớn hơn 0' };
  }
  
  if (limit < 1 || limit > 100) {
    return { valid: false, message: 'Limit phải từ 1 đến 100' };
  }
  
  return { valid: true, data: { page, limit } };
};

/**
 * Validate sort params
 */
const validateSort = (query, allowedFields = ['createdAt', 'updatedAt']) => {
  const { sortBy = 'createdAt', sortOrder = 'desc' } = query;
  
  if (!allowedFields.includes(sortBy)) {
    return { valid: false, message: `SortBy phải là một trong: ${allowedFields.join(', ')}` };
  }
  
  if (!['asc', 'desc'].includes(sortOrder)) {
    return { valid: false, message: 'SortOrder phải là asc hoặc desc' };
  }
  
  return { valid: true, data: { sortBy, sortOrder } };
};

module.exports = {
  isValidObjectId,
  isValidEmail,
  isValidUsername,
  isValidPassword,
  validateRequiredFields,
  validatePagination,
  validateSort,
};
