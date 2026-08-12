const router = require('express').Router();
const controller = require('./helpproject.controller.admin');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/statistics', authenticate, authorize('admin'), controller.getStatistics);
router.get('/all', authenticate, authorize('admin'), controller.getAllProjects);
router.get('/:id', authenticate, authorize('admin'), controller.getProjectById);
router.post('/:id/reply', authenticate, authorize('admin'), controller.addReply);
router.put('/:id/status', authenticate, authorize('admin'), controller.updateStatus);
router.delete('/:id', authenticate, authorize('admin'), controller.deleteProject);

module.exports = router;
