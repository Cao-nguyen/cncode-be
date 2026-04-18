const express = require('express')
const router = express.Router()
const uploadController = require('./upload.controller')
const { authenticate } = require('../../middleware/auth.middleware')

router.post('/single', authenticate, uploadController.upload.single('image'), uploadController.uploadImage)
router.post('/multiple', authenticate, uploadController.upload.array('images', 10), uploadController.uploadMultipleImages)

module.exports = router