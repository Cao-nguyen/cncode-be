const { ForumPost } = require('./forum-post.model');
const User = require('../user/user.model');

// Helper function to emit socket event
const emitSocketEvent = (io, event, data) => {
    if (io) {
        io.to('forum').emit(event, data);
    }
};

// Create a new forum post
const createPost = async (req, res) => {
    try {
        const userId = req.userId;
        const { content, images, videos, privacy, feeling, location, taggedUsers } = req.body;

        const post = new ForumPost({
            content,
            images: images || [],
            videos: videos || [],
            author: userId,
            privacy: privacy || 'public',
            feeling: feeling || null,
            location: location || null,
            taggedUsers: taggedUsers || [],
        });

        await post.save();

        // Populate author data
        await post.populate('author', 'fullName username avatar role');

        // Emit socket event
        const io = req.app.get('io');
        emitSocketEvent(io, 'forum:post-created', {
            postId: post._id,
            post,
        });

        res.status(201).json({
            success: true,
            message: 'Đăng bài thành công',
            data: post,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đăng bài',
            error: error.message,
        });
    }
};

// Get all forum posts (feed)
const getPosts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const posts = await ForumPost.find({ isDeleted: false })
            .populate('author', 'fullName username avatar role')
            .populate('taggedUsers', 'fullName username avatar')
            .populate('originalPost', 'content author')
            .sort({ isPinned: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await ForumPost.countDocuments({ isDeleted: false });

        res.json({
            success: true,
            data: posts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách bài viết',
            error: error.message,
        });
    }
};

// Get a single post by ID
const getPostById = async (req, res) => {
    try {
        const { postId } = req.params;

        const post = await ForumPost.findOne({ _id: postId, isDeleted: false })
            .populate('author', 'fullName username avatar role')
            .populate('taggedUsers', 'fullName username avatar')
            .populate('originalPost', 'content author')
            .populate('comments');

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết',
            });
        }

        res.json({
            success: true,
            data: post,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy bài viết',
            error: error.message,
        });
    }
};

// Get posts by author
const getPostsByAuthor = async (req, res) => {
    try {
        const { authorId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const posts = await ForumPost.find({ author: authorId, isDeleted: false })
            .populate('author', 'fullName username avatar role')
            .populate('taggedUsers', 'fullName username avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await ForumPost.countDocuments({ author: authorId, isDeleted: false });

        res.json({
            success: true,
            data: posts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy bài viết của người dùng',
            error: error.message,
        });
    }
};

// Update a post
const updatePost = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId } = req.params;
        const { content, images, videos, privacy, feeling, location, taggedUsers } = req.body;

        const post = await ForumPost.findOne({ _id: postId, isDeleted: false });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết',
            });
        }

        // Check if user is the author
        if (post.author.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền sửa bài viết này',
            });
        }

        post.content = content || post.content;
        post.images = images || post.images;
        post.videos = videos || post.videos;
        post.privacy = privacy || post.privacy;
        post.feeling = feeling !== undefined ? feeling : post.feeling;
        post.location = location !== undefined ? location : post.location;
        post.taggedUsers = taggedUsers || post.taggedUsers;
        post.isEdited = true;
        post.editedAt = new Date();

        await post.save();

        await post.populate('author', 'fullName username avatar role');

        res.json({
            success: true,
            message: 'Cập nhật bài viết thành công',
            data: post,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật bài viết',
            error: error.message,
        });
    }
};

// Delete a post (soft delete)
const deletePost = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId } = req.params;
        const io = req.app.get('io');

        const post = await ForumPost.findOne({ _id: postId, isDeleted: false });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết',
            });
        }

        // Check if user is the author
        if (post.author.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xóa bài viết này',
            });
        }

        post.isDeleted = true;
        post.deletedAt = new Date();

        await post.save();

        // Emit socket event
        emitSocketEvent(io, 'forum:post-deleted', {
            postId,
        });

        res.json({
            success: true,
            message: 'Xóa bài viết thành công',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa bài viết',
            error: error.message,
        });
    }
};

// Like/Unlike a post (now handles reactions)
const toggleLikePost = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId } = req.params;
        const { reaction = 'like' } = req.body; // Default to 'like' if not specified
        const io = req.app.get('io');

        const post = await ForumPost.findOne({ _id: postId, isDeleted: false });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết',
            });
        }

        // Check if user already reacted
        const existingReactionIndex = post.userReactions?.findIndex(
            (r) => r.userId.toString() === userId
        );

        if (existingReactionIndex > -1) {
            const existingReaction = post.userReactions[existingReactionIndex];
            
            if (existingReaction.reaction === reaction) {
                // Remove reaction (toggle off)
                post.reactions[reaction] = Math.max(0, post.reactions[reaction] - 1);
                post.userReactions.splice(existingReactionIndex, 1);
            } else {
                // Change reaction
                post.reactions[existingReaction.reaction] = Math.max(0, post.reactions[existingReaction.reaction] - 1);
                post.reactions[reaction] = (post.reactions[reaction] || 0) + 1;
                post.userReactions[existingReactionIndex].reaction = reaction;
            }
        } else {
            // Add new reaction
            post.reactions[reaction] = (post.reactions[reaction] || 0) + 1;
            if (!post.userReactions) post.userReactions = [];
            post.userReactions.push({ userId, reaction });
        }

        // Update total like count
        post.likeCount = Object.values(post.reactions).reduce((sum, count) => sum + count, 0);

        await post.save();

        // Emit socket event
        emitSocketEvent(io, 'forum:post-liked', {
            postId,
            reactions: post.reactions,
            likeCount: post.likeCount,
            userId,
            reaction,
        });

        res.json({
            success: true,
            message: existingReactionIndex > -1 && post.userReactions[existingReactionIndex]?.reaction === reaction ? 'Đã bỏ thích' : 'Đã thích bài viết',
            reactions: post.reactions,
            likeCount: post.likeCount,
            userReaction: existingReactionIndex > -1 ? post.userReactions[existingReactionIndex]?.reaction : reaction,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thích bài viết',
            error: error.message,
        });
    }
};

// Pin/Unpin a post
const togglePinPost = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId } = req.params;

        const post = await ForumPost.findOne({ _id: postId, isDeleted: false });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết',
            });
        }

        // Check if user is the author
        if (post.author.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền ghim bài viết này',
            });
        }

        post.isPinned = !post.isPinned;

        await post.save();

        res.json({
            success: true,
            message: post.isPinned ? 'Đã ghim bài viết' : 'Đã bỏ ghim bài viết',
            isPinned: post.isPinned,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi ghim bài viết',
            error: error.message,
        });
    }
};

// Share a post
const sharePost = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId } = req.params;
        const { content } = req.body;

        const originalPost = await ForumPost.findOne({ _id: postId, isDeleted: false });

        if (!originalPost) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài viết',
            });
        }

        const newPost = new ForumPost({
            content: content || '',
            author: userId,
            originalPost: postId,
            privacy: 'public',
        });

        await newPost.save();

        // Update original post share count
        originalPost.shares.push(userId);
        originalPost.shareCount += 1;
        await originalPost.save();

        await newPost.populate('author', 'fullName username avatar role');

        res.status(201).json({
            success: true,
            message: 'Chia sẻ bài viết thành công',
            data: newPost,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi chia sẻ bài viết',
            error: error.message,
        });
    }
};

module.exports = {
    createPost,
    getPosts,
    getPostById,
    getPostsByAuthor,
    updatePost,
    deletePost,
    toggleLikePost,
    togglePinPost,
    sharePost,
};
