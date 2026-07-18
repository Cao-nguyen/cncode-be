const router = require('express').Router();
const controller = require('./helpproject.controller.user');
const { authenticate } = require('../../middleware/auth.middleware');

router.post('/', authenticate, controller.createProject);
router.get('/my-projects', authenticate, controller.getUserProjects);
router.get('/:id', authenticate, controller.getProjectById);
router.put('/:id', authenticate, controller.updateProject);
router.delete('/:id', authenticate, controller.deleteProject);
router.post('/:id/reply', authenticate, controller.addReply);

module.exports = router;
