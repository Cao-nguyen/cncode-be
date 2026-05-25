// modules/linkedProduct/linkedProduct.routes.js
const router = require('express').Router();
const controller = require('./linkedProduct.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// ========== PUBLIC ROUTES (không cần auth) ==========
router.get('/public', controller.getPublicProducts);
router.get('/public/:id', controller.getById);

// ========== PROTECTED ROUTES (cần auth) ==========
// Dùng authenticate middleware để set req.userId
router.use(authenticate);

// Admin/User routes
router.post('/', controller.create);
router.get('/my-products', controller.getUserProducts);
router.put('/sort-order', controller.updateSortOrder);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;