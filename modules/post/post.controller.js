const Post = require('./post.model');

const createSlug = (title) => {
  const date = new Date();
  const timestamp = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-${timestamp}`;
};

const getAllPosts = async (req, res) => {
  try {
    const { category, search, sort, page = 1, limit = 10, status } = req.query;
    const query = { status: status || 'published' };

    if (category) query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };

    const sortOption = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
    const skip = (Number(page) - 1) * Number(limit);

    const [posts, total] = await Promise.all([
      Post.find(query)
        .select('title slug description thumbnail category author readTime likes views createdAt')
        .populate('author', 'fullName avatar bio')
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Post.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPostBySlug = async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug })
      .populate('author', 'fullName avatar bio')
      .populate('comments.user', 'fullName avatar')
      .lean();

    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    res.json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const trackPostView = async (req, res) => {
  try {
    const post = await Post.findOneAndUpdate(
      { slug: req.params.slug },
      { $inc: { views: 1 } },
      { new: true, select: 'views' },
    );
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, data: { views: post.views } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserPosts = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { author: req.userId };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('author', 'fullName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Post.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createPost = async (req, res) => {
  try {
    // ✅ Luôn tạo slug mới từ title + timestamp, bỏ qua slug FE gửi lên
    const slug = createSlug(req.body.title);
    const post = new Post({ ...req.body, slug, author: req.userId });
    await post.save();
    await post.populate('author', 'fullName avatar bio');
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    console.error('CREATE POST ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updatePost = async (req, res) => {
  try {
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id, author: req.userId },
      { ...req.body, updatedAt: Date.now() },
      { new: true },
    ).populate('author', 'fullName avatar bio');

    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({ _id: req.params.id, author: req.userId });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, data: null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'fullName avatar');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const alreadyLiked = post.likedBy.includes(req.userId);
    if (alreadyLiked) {
      post.likedBy.pull(req.userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedBy.push(req.userId);
      post.likes += 1;

      const io = req.app.get('io');
      const authorId = post.author._id.toString();
      if (io && authorId !== req.userId) {
        io.to(authorId).emit('new_notification', {
          type: 'like_post',
          postId: post.slug,
          postTitle: post.title,
          userName: req.userName || 'Người dùng',
          userId: req.userId,
          createdAt: new Date(),
        });
      }
    }

    await post.save();
    res.json({ success: true, data: { liked: !alreadyLiked, likes: post.likes } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const bookmarkPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const alreadyBookmarked = post.bookmarks.includes(req.userId);
    if (alreadyBookmarked) post.bookmarks.pull(req.userId);
    else post.bookmarks.push(req.userId);
    await post.save();

    res.json({ success: true, data: { bookmarked: !alreadyBookmarked } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const reportPost = async (req, res) => {
  try {
    const { reason } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const alreadyReported = post.reportedBy.some((r) => r.user.toString() === req.userId);
    if (alreadyReported)
      return res.status(400).json({ success: false, message: 'Bạn đã báo cáo bài viết này' });

    post.reportedBy.push({ user: req.userId, reason });
    await post.save();
    res.json({ success: true, data: null, message: 'Đã ghi nhận báo cáo' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addComment = async (req, res) => {
  try {
    const { content, parentId } = req.body;
    const post = await Post.findById(req.params.id)
      .populate('author', 'fullName avatar')
      .populate('comments.user', 'fullName');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    let replyToName = null;
    let recipientId = null;

    if (parentId) {
      const parent = post.comments.id(parentId);
      if (parent) {
        replyToName = parent.user?.fullName ?? null;
        recipientId = parent.user?._id?.toString() ?? null;
      }
    }

    if (!recipientId) {
      recipientId = post.author._id.toString();
    }

    post.comments.push({ user: req.userId, content, parentId: parentId || null, replyToName });
    await post.save();
    await post.populate('comments.user', 'fullName avatar');

    const io = req.app.get('io');
    if (io) {
      if (recipientId !== req.userId) {
        io.to(recipientId).emit('new_notification', {
          type: 'comment',
          postId: post.slug,
          postTitle: post.title,
          userName: req.userName || 'Người dùng',
          content,
          commentId: parentId || null,
          createdAt: new Date(),
        });
      }
      io.emit('post:new_comment', { postSlug: post.slug });
    }

    res.json({ success: true, data: post.comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const isOwner = comment.user.toString() === req.userId;
    const isAuthor = post.author.toString() === req.userId;
    if (!isOwner && !isAuthor)
      return res.status(403).json({ success: false, message: 'Forbidden' });

    post.comments = post.comments.filter(
      (c) =>
        c._id.toString() !== req.params.commentId &&
        c.parentId?.toString() !== req.params.commentId,
    );
    await post.save();
    await post.populate('comments.user', 'fullName avatar');

    const io = req.app.get('io');
    if (io) io.emit('post:new_comment', { postSlug: post.slug });

    res.json({ success: true, data: post.comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const editComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim())
      return res.status(400).json({ success: false, message: 'Nội dung không được để trống' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    if (comment.user.toString() !== req.userId)
      return res.status(403).json({ success: false, message: 'Forbidden' });

    comment.content = content.trim();
    comment.editedAt = new Date();
    await post.save();
    await post.populate('comments.user', 'fullName avatar');

    const io = req.app.get('io');
    if (io) io.emit('post:new_comment', { postSlug: post.slug });

    res.json({ success: true, data: post.comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleCommentReaction = async (req, res) => {
  try {
    const { type } = req.body;
    const validTypes = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'];
    if (!validTypes.includes(type))
      return res.status(400).json({ success: false, message: 'Invalid reaction type' });

    const post = await Post.findById(req.params.id).populate('author', 'fullName avatar');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const hasReacted = comment.reactions[type].includes(req.userId);
    validTypes.forEach((t) => {
      comment.reactions[t] = comment.reactions[t].filter((id) => id.toString() !== req.userId);
    });
    if (!hasReacted) comment.reactions[type].push(req.userId);

    await post.save();

    const io = req.app.get('io');
    if (io) {
      const commentOwnerId = comment.user.toString();
      if (commentOwnerId !== req.userId) {
        io.to(commentOwnerId).emit('new_notification', {
          type: 'reaction_comment',
          postId: post.slug,
          postTitle: post.title,
          userName: req.userName || 'Người dùng',
          reactionType: type,
          commentId: comment._id,
          createdAt: new Date(),
        });
      }
      io.emit('post:new_reaction', { postSlug: post.slug });
    }

    res.json({ success: true, data: { type, hasReacted: !hasReacted } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const reportComment = async (req, res) => {
  try {
    const { reason } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const alreadyReported = comment.reportedBy?.some((r) => r.user.toString() === req.userId);
    if (alreadyReported)
      return res.status(400).json({ success: false, message: 'Bạn đã báo cáo bình luận này' });

    comment.reportedBy = comment.reportedBy || [];
    comment.reportedBy.push({ user: req.userId, reason });
    await post.save();

    res.json({ success: true, data: null, message: 'Đã ghi nhận báo cáo' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getFeaturedBlogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 3
    const blogs = await blogService.getFeaturedBlogs(limit)

    res.status(200).json({
      success: true,
      data: blogs
    })
  } catch (error) {
    console.error('Get featured blogs error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

module.exports = {
  getAllPosts,
  getPostBySlug,
  trackPostView,
  getUserPosts,
  createPost,
  updatePost,
  deletePost,
  likePost,
  bookmarkPost,
  reportPost,
  addComment,
  deleteComment,
  editComment,
  toggleCommentReaction,
  reportComment,
  getFeaturedBlogs,
};