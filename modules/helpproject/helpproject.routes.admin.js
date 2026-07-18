const router = require('express').Router();
const controller = require('./helpproject.controller.admin');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/all', authenticate, authorize('admin'), controller.getAllProjects);
router.get('/statistics', authenticate, authorize('admin'), controller.getStatistics);
router.get('/:id', authenticate, authorize('admin'), controller.getProjectById);
router.delete('/:id', authenticate, authorize('admin'), controller.deleteProject);
router.put('/:id/status', authenticate, authorize('admin'), controller.updateStatus);

module.exports = router;
