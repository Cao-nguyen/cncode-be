/**
 * Encrypted File Routes
 */
const express = require('express');
const router = express.Router();
const controller = require('./encrypted-file.controller');

// Upload endpoints
router.post('/image', controller.uploadImage);
router.post('/images/multiple', controller.uploadMultipleImages);
router.post('/video', controller.uploadVideoFile);
router.post('/document', controller.uploadDocument);

// Serve encrypted files
router.get('/image/:fileId', controller.serveEncryptedImage);
router.get('/stream/video/:fileId', controller.streamVideo);
router.get('/:type/:fileId', controller.serveEncryptedFile);

// File info
router.get('/info/:fileId', controller.getFileInfo);

// List user files (requires auth)
router.get('/files', controller.listUserFiles);

module.exports = router;