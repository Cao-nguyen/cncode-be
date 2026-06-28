const express = require('express');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth.middleware');
const ctrl = require('./luyentap.controller');

// Public / student
router.get('/', optionalAuth, ctrl.listPublic);
router.get('/attempt/:attemptId', authenticate, ctrl.getAttempt);
router.post('/run-code', authenticate, ctrl.runCodeTest);

// Admin (before :id routes)
router.get('/admin/all', authenticate, authorize('admin'), ctrl.listAdmin);
router.get('/admin/:id', authenticate, authorize('admin'), ctrl.getAdminById);
router.post('/admin', authenticate, authorize('admin'), ctrl.createAdmin);
router.put('/admin/:id', authenticate, authorize('admin'), ctrl.updateAdmin);
router.delete('/admin/:id', authenticate, authorize('admin'), ctrl.deleteAdmin);
router.put('/admin/:id/approve', authenticate, authorize('admin'), ctrl.approve);
router.put('/admin/:id/reject', authenticate, authorize('admin'), ctrl.reject);

// Teacher
router.get('/teacher/mine', authenticate, authorize('teacher', 'admin'), ctrl.listTeacher);
router.get('/teacher/:id', authenticate, authorize('teacher', 'admin'), ctrl.getTeacherById);
router.post('/teacher', authenticate, authorize('teacher', 'admin'), ctrl.createTeacher);
router.put('/teacher/:id', authenticate, authorize('teacher', 'admin'), ctrl.updateTeacher);
router.delete('/teacher/:id', authenticate, authorize('teacher', 'admin'), ctrl.deleteTeacher);
router.put('/teacher/:id/submit', authenticate, authorize('teacher', 'admin'), ctrl.submitForReview);

// Student taking
router.get('/:id/take', authenticate, ctrl.getForTaking);
router.post('/:id/submit', authenticate, ctrl.submitAttempt);
router.get('/:id/attempts', authenticate, ctrl.getMyAttempts);
router.get('/:id', optionalAuth, ctrl.getById);

module.exports = router;
