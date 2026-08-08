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

// User routes - Protected (must be before parameterized routes)
router.get('/user/my-links', authenticate, getUserShortLinks);
router.post('/user/create', authenticate, createUserShortLink);
router.put('/user/:id', authenticate, updateUserShortLink);
router.delete('/user/:id', authenticate, deleteUserShortLink);

// Public route - Redirect short link (must be last to avoid conflict)
router.get('/:shortCode', redirectShortLink);

module.exports = router;
