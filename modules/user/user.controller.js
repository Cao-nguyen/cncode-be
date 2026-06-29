// Refactored user controller - imports from sub-controllers
const profileController = require('./user.profile.controller');
const accountController = require('./user.account.controller');
const adminController = require('./user.admin.controller');

// Re-export all functions
module.exports = {
  // Profile management
  ...profileController,
  
  // Account management
  ...accountController,
  
  // Admin functions
  ...adminController,
};