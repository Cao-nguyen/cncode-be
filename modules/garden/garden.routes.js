const express = require('express');
const router = express.Router();
const controller = require('./garden.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.get('/status', authenticate, controller.getGarden);
router.get('/stats', authenticate, controller.getGardenStats);
router.get('/trees', authenticate, controller.getAvailableTrees);
router.post('/buy', authenticate, controller.buyTree);
router.post('/plant', authenticate, controller.plantTree);
router.post('/harvest', authenticate, controller.harvestTree);
router.post('/water', authenticate, controller.waterTree);
router.get('/question', authenticate, controller.getQuestion);
router.post('/answer', authenticate, controller.submitAnswer);

router.get('/admin/questions', authenticate, authorize('admin'), controller.getAllQuestions);
router.post('/admin/questions', authenticate, authorize('admin'), controller.addQuestion);
router.post('/admin/questions/bulk', authenticate, authorize('admin'), controller.addMultipleQuestions);
router.put('/admin/questions/:id', authenticate, authorize('admin'), controller.updateQuestion);
router.delete('/admin/questions/:id', authenticate, authorize('admin'), controller.deleteQuestion);
router.get('/admin/trees', authenticate, authorize('admin'), controller.getAllTrees);
router.post('/admin/trees', authenticate, authorize('admin'), controller.addTree);
router.put('/admin/trees/:id', authenticate, authorize('admin'), controller.updateTree);
router.delete('/admin/trees/:id', authenticate, authorize('admin'), controller.deleteTree);

module.exports = router;