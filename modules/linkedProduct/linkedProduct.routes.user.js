const router = require('express').Router();
const controller = require('./linkedProduct.controller.user');

router.get('/public', controller.getPublicProducts);
router.get('/public/:id', controller.getById);

module.exports = router;
