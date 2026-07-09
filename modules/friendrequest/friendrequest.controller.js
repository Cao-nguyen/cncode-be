const FriendRequest = require('./friendrequest.model');
const User = require('../user/user.model');
const Notification = require('../notification/notification.model');

// Send friend request
exports.sendFriendRequest = async (req, res) => {
    try {
        const senderId = req.userId;
        const { receiverId, message } = req.body;

        if (!receiverId) {
            return res.status(400).json({ success: false, message: 'Receiver ID is required' });
        }

        if (senderId === receiverId) {
            return res.status(400).json({ success: false, message: 'Không thể gửi lời mời kết bạn cho chính mình' });
        }

        // Check if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
        }

        // Check if already friends
        const sender = await User.findById(senderId);
        if (sender.following.includes(receiverId)) {
            return res.status(400).json({ success: false, message: 'Đã là bạn bè' });
        }

        // Check if request already exists
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { sender: senderId, receiver: receiverId, status: 'pending' },
                { sender: receiverId, receiver: senderId, status: 'pending' }
            ]
        });

        if (existingRequest) {
            return res.status(400).json({ success: false, message: 'Đã có lời mời kết bạn đang chờ xử lý' });
        }

        // Create friend request
        const friendRequest = new FriendRequest({
            sender: senderId,
            receiver: receiverId,
            message: message || ''
        });

        await friendRequest.save();

        // Create notification for receiver
        const notification = new Notification({
            userId: receiverId,
            type: 'friend_request',
            message: `${sender.fullName} đã gửi lời mời kết bạn`,
            relatedId: friendRequest._id,
            relatedModel: 'FriendRequest'
        });
        await notification.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(receiverId.toString()).emit('friend_request', {
                type: 'new_request',
                friendRequest: await FriendRequest.findById(friendRequest._id)
                    .populate('sender', 'fullName username avatar')
            });
            io.to(receiverId.toString()).emit('notification', notification);
        }

        res.status(201).json({
            success: true,
            message: 'Đã gửi lời mời kết bạn',
            data: await FriendRequest.findById(friendRequest._id)
                .populate('receiver', 'fullName username avatar')
        });
    } catch (error) {
        console.error('Error sending friend request:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

// Accept friend request
exports.acceptFriendRequest = async (req, res) => {
    try {
        const userId = req.userId;
        const { requestId } = req.params;

        const friendRequest = await FriendRequest.findById(requestId)
            .populate('sender', 'fullName username avatar');

        if (!friendRequest) {
            return res.status(404).json({ success: false, message: 'Lời mời không tồn tại' });
        }

        if (friendRequest.receiver.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Không có quyền' });
        }

        if (friendRequest.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Lời mời đã được xử lý' });
        }

        // Update friend request status
        friendRequest.status = 'accepted';
        await friendRequest.save();

        // Add to each other's following/followers list
        await User.findByIdAndUpdate(friendRequest.sender, {
            $addToSet: { following: friendRequest.receiver }
        });

        await User.findByIdAndUpdate(friendRequest.receiver, {
            $addToSet: { followers: friendRequest.sender }
        });

        // Create notification for sender
        const receiver = await User.findById(userId);
        const notification = new Notification({
            userId: friendRequest.sender._id,
            type: 'friend_request_accepted',
            message: `${receiver.fullName} đã chấp nhận lời mời kết bạn`,
            relatedId: userId,
            relatedModel: 'User'
        });
        await notification.save();

        // Emit socket events
        const io = req.app.get('io');
        if (io) {
            io.to(friendRequest.sender._id.toString()).emit('friend_request', {
                type: 'request_accepted',
                friendRequest
            });
            io.to(friendRequest.sender._id.toString()).emit('notification', notification);
        }

        res.json({
            success: true,
            message: 'Đã chấp nhận lời mời kết bạn',
            data: friendRequest
        });
    } catch (error) {
        console.error('Error accepting friend request:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

// Reject friend request
exports.rejectFriendRequest = async (req, res) => {
    try {
        const userId = req.userId;
        const { requestId } = req.params;

        const friendRequest = await FriendRequest.findById(requestId);

        if (!friendRequest) {
            return res.status(404).json({ success: false, message: 'Lời mời không tồn tại' });
        }

        if (friendRequest.receiver.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Không có quyền' });
        }

        if (friendRequest.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Lời mời đã được xử lý' });
        }

        friendRequest.status = 'rejected';
        await friendRequest.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(friendRequest.sender.toString()).emit('friend_request', {
                type: 'request_rejected',
                friendRequest
            });
        }

        res.json({
            success: true,
            message: 'Đã từ chối lời mời kết bạn',
            data: friendRequest
        });
    } catch (error) {
        console.error('Error rejecting friend request:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

// Cancel friend request (by sender)
exports.cancelFriendRequest = async (req, res) => {
    try {
        const userId = req.userId;
        const { requestId } = req.params;

        const friendRequest = await FriendRequest.findById(requestId);

        if (!friendRequest) {
            return res.status(404).json({ success: false, message: 'Lời mời không tồn tại' });
        }

        if (friendRequest.sender.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Không có quyền' });
        }

        if (friendRequest.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Lời mời đã được xử lý' });
        }

        friendRequest.status = 'cancelled';
        await friendRequest.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(friendRequest.receiver.toString()).emit('friend_request', {
                type: 'request_cancelled',
                friendRequest
            });
        }

        res.json({
            success: true,
            message: 'Đã hủy lời mời kết bạn',
            data: friendRequest
        });
    } catch (error) {
        console.error('Error cancelling friend request:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

// Get sent friend requests
exports.getSentRequests = async (req, res) => {
    try {
        const userId = req.userId;

        const requests = await FriendRequest.find({
            sender: userId,
            status: 'pending'
        })
            .populate('receiver', 'fullName username avatar')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: requests
        });
    } catch (error) {
        console.error('Error getting sent requests:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

// Get received friend requests
exports.getReceivedRequests = async (req, res) => {
    try {
        const userId = req.userId;

        const requests = await FriendRequest.find({
            receiver: userId,
            status: 'pending'
        })
            .populate('sender', 'fullName username avatar')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: requests
        });
    } catch (error) {
        console.error('Error getting received requests:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

// Get friends list
exports.getFriends = async (req, res) => {
    try {
        const userId = req.userId;

        const user = await User.findById(userId)
            .populate('following', 'fullName username avatar bio lastActiveAt')
            .populate('followers', 'fullName username avatar bio lastActiveAt');

        // Get mutual friends (both following and followers)
        const friends = user.following.filter(followingUser =>
            user.followers.some(follower =>
                follower._id.toString() === followingUser._id.toString()
            )
        );

        res.json({
            success: true,
            data: friends
        });
    } catch (error) {
        console.error('Error getting friends:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

// Unfriend
exports.unfriend = async (req, res) => {
    try {
        const userId = req.userId;
        const { friendId } = req.params;

        if (userId === friendId) {
            return res.status(400).json({ success: false, message: 'Không thể hủy kết bạn với chính mình' });
        }

        // Remove from each other's following/followers list
        await User.findByIdAndUpdate(userId, {
            $pull: { following: friendId }
        });

        await User.findByIdAndUpdate(friendId, {
            $pull: { followers: userId }
        });

        res.json({
            success: true,
            message: 'Đã hủy kết bạn'
        });
    } catch (error) {
        console.error('Error unfriending:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};