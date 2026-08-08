const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth.middleware');
const {
    redirectShortLink,
    getUserShortLinks,
    createUserShortLink,
    updateUserShortLink,
    deleteUserShortLink
} = require('./rutgonlink.controller.user');

// Public route - Redirect short link
router.get('/:shortCode', redirectShortLink);

// User routes - Protected
router.get('/user/my-links', authenticate, getUserShortLinks);
router.post('/user/create', authenticate, createUserShortLink);
router.put('/user/:id', authenticate, updateUserShortLink);
router.delete('/user/:id', authenticate, deleteUserShortLink);

module.exports = router;
