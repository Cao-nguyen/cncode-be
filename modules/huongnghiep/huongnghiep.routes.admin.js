const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const {
    getAllTrainingPlaces,
    getTrainingPlaceById,
    createTrainingPlace,
    updateTrainingPlace,
    deleteTrainingPlace,
    getAllIndustries,
    getIndustryById,
    createIndustry,
    updateIndustry,
    deleteIndustry
} = require('./huongnghiep.controller.admin');

// Admin routes - Industries (must come first to avoid route conflicts)
router.get('/industries/all', authenticate, authorize('admin'), getAllIndustries);
router.get('/industries/:id', authenticate, authorize('admin'), getIndustryById);
router.post('/industries', authenticate, authorize('admin'), createIndustry);
router.put('/industries/:id', authenticate, authorize('admin'), updateIndustry);
router.delete('/industries/:id', authenticate, authorize('admin'), deleteIndustry);

// Admin routes - Training Places
router.get('/all', authenticate, authorize('admin'), getAllTrainingPlaces);
router.get('/:id', authenticate, authorize('admin'), getTrainingPlaceById);
router.post('/', authenticate, authorize('admin'), createTrainingPlace);
router.put('/:id', authenticate, authorize('admin'), updateTrainingPlace);
router.delete('/:id', authenticate, authorize('admin'), deleteTrainingPlace);

module.exports = router;
