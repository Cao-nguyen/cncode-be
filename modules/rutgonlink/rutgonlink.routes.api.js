const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../../middleware/apiKey.middleware');
const { batchCreate, getUserLinks } = require('./rutgonlink.controller.api');

// Public API endpoints for external websites
router.get('/links', validateApiKey, getUserLinks);
router.post('/batch', validateApiKey, batchCreate);

module.exports = router;
