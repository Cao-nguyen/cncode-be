const router = require('express').Router();
const controller = require('./systemSettings.controller.user');

router.get('/:slug', controller.getPublicContent);

module.exports = router;
