const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const {
    getStats,
    getAllIndustries,
    getIndustryById,
    createIndustry,
    updateIndustry,
    deleteIndustry,
    togglePublish,
    getIndustriesByGroup,
    getIndustryBySlug,
    getAllWorkplaces,
    createWorkplace,
    updateWorkplace,
    deleteWorkplace,
    getAllTrainingPlaces,
    createTrainingPlace,
    updateTrainingPlace,
    deleteTrainingPlace,
} = require('./huongnghiep.controller');

// Admin routes - Industries
router.get('/admin/stats', authenticate, authorize('admin'), getStats);
router.get('/admin/all', authenticate, authorize('admin'), getAllIndustries);
router.post('/admin', authenticate, authorize('admin'), createIndustry);

// Admin routes - Workplaces
router.get('/admin/workplaces', authenticate, authorize('admin'), getAllWorkplaces);
router.post('/admin/workplaces', authenticate, authorize('admin'), createWorkplace);
router.put('/admin/workplaces/:id', authenticate, authorize('admin'), updateWorkplace);
router.delete('/admin/workplaces/:id', authenticate, authorize('admin'), deleteWorkplace);

// Admin routes - Training Places
router.get('/admin/training-places', authenticate, authorize('admin'), getAllTrainingPlaces);
router.post('/admin/training-places', authenticate, authorize('admin'), createTrainingPlace);
router.put('/admin/training-places/:id', authenticate, authorize('admin'), updateTrainingPlace);
router.delete('/admin/training-places/:id', authenticate, authorize('admin'), deleteTrainingPlace);

// Admin routes - Industries (parameterized routes must come last)
router.get('/admin/:id', authenticate, authorize('admin'), getIndustryById);
router.put('/admin/:id', authenticate, authorize('admin'), updateIndustry);
router.delete('/admin/:id', authenticate, authorize('admin'), deleteIndustry);
router.patch('/admin/:id/publish', authenticate, authorize('admin'), togglePublish);

// Public routes
router.get('/group/:group', getIndustriesByGroup);
router.get('/slug/:slug', getIndustryBySlug);

module.exports = router;
