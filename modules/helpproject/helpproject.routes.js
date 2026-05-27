const express = require('express');
const router = express.Router();
const controller = require('./helpproject.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.post('/', authenticate, controller.createProject);
router.get('/my-projects', authenticate, controller.getUserProjects);
router.get('/:id', authenticate, controller.getProjectById);
router.put('/:id', authenticate, controller.updateProject);
router.delete('/:id', authenticate, controller.deleteProject);

router.get('/admin/list', authenticate, authorize('admin'), controller.getAllProjects);
router.get('/admin/statistics', authenticate, authorize('admin'), controller.getStatistics);
router.post('/admin/:id/reply', authenticate, authorize('admin'), controller.addReply);
router.put('/admin/:id/status', authenticate, authorize('admin'), controller.updateStatus);
router.delete('/admin/:id', authenticate, authorize('admin'), controller.deleteProject);

module.exports = router;
