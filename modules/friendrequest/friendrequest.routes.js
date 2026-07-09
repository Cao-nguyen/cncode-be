const express = require('express');
const router = express.Router();
const friendRequestController = require('./friendrequest.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Send friend request
router.post('/send', authenticate, friendRequestController.sendFriendRequest);

// Accept friend request
router.post('/accept/:requestId', authenticate, friendRequestController.acceptFriendRequest);

// Reject friend request
router.post('/reject/:requestId', authenticate, friendRequestController.rejectFriendRequest);

// Cancel friend request
router.post('/cancel/:requestId', authenticate, friendRequestController.cancelFriendRequest);

// Get sent friend requests
router.get('/sent', authenticate, friendRequestController.getSentRequests);

// Get received friend requests
router.get('/received', authenticate, friendRequestController.getReceivedRequests);

// Get friends list
router.get('/', authenticate, friendRequestController.getFriends);

// Unfriend
router.delete('/unfriend/:friendId', authenticate, friendRequestController.unfriend);

module.exports = router;