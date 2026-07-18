const router = require('express').Router();
const controller = require('./linkedProduct.controller.admin');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);

router.post('/', controller.create);
router.get('/my-products', controller.getUserProducts);
router.put('/sort-order', controller.updateSortOrder);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
