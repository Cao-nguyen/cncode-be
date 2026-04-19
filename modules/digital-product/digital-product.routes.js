const express = require('express')
const router = express.Router()
const digitalProductController = require('./digital-product.controller')
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware')

router.get('/', optionalAuth, digitalProductController.getProducts)
router.get('/me', authenticate, digitalProductController.getUserProducts)
router.get('/:slug', optionalAuth, digitalProductController.getProductBySlug)
router.post('/', authenticate, digitalProductController.createProduct)
router.put('/:id', authenticate, digitalProductController.updateProduct)
router.delete('/:id', authenticate, digitalProductController.deleteProduct)

module.exports = router