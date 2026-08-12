const router = require('express').Router();
const { create, getUserProducts, update, deleteProduct, updateSortOrder } = require('./linkedProduct.controller.admin');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);

router.post('/', create);
router.get('/my-products', getUserProducts);
router.put('/sort-order', updateSortOrder);
router.put('/:id', update);
router.delete('/:id', deleteProduct);

module.exports = router;
