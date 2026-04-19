const Post = require('./post.model');

const getAllPosts = async (req, res) => {
  try {
    const { category, search, sort, page = 1, limit = 10, status } = req.query;
    const query = {};

    if (status) query.status = status;
    else query.status = 'published';

    if (category) query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };

    const sortOption = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
    const skip = (Number(page) - 1) * Number(limit);

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('author', 'fullName avatar bio')
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit)),
      Post.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPostBySlug = async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug })
      .populate('author', 'fullName avatar bio')
      .populate('comments.user', 'fullName avatar');

    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });
    post.views += 1;

    res.json({ success: true, data: post });
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
      Post.find(query).populate('author', 'fullName avatar').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Post.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createPost = async (req, res) => {
  try {
    const post = new Post({ ...req.body, author: req.userId });
    await post.save();
    await post.populate('author', 'fullName avatar bio');
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updatePost = async (req, res) => {
  try {
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id, author: req.userId },
      { ...req.body, updatedAt: Date.now() },
      { new: true }
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
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const alreadyLiked = post.likedBy.includes(req.userId);
    if (alreadyLiked) {
      post.likedBy.pull(req.userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedBy.push(req.userId);
      post.likes += 1;
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
    if (alreadyBookmarked) {
      post.bookmarks.pull(req.userId);
    } else {
      post.bookmarks.push(req.userId);
    }
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
    if (alreadyReported) return res.status(400).json({ success: false, message: 'Bạn đã báo cáo bài viết này' });

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
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    let replyToName = null;
    if (parentId) {
      const parent = post.comments.id(parentId);
      if (parent) {
        await post.populate({ path: 'comments.user', select: 'fullName' });
        const parentUser = post.comments.id(parentId)?.user;
        replyToName = parentUser?.fullName ?? null;
      }
    }

    post.comments.push({ user: req.userId, content, parentId: parentId || null, replyToName });
    await post.save();
    await post.populate('comments.user', 'fullName avatar');

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
    if (!isOwner && !isAuthor) return res.status(403).json({ success: false, message: 'Forbidden' });

    post.comments = post.comments.filter(
      (c) => c._id.toString() !== req.params.commentId && c.parentId?.toString() !== req.params.commentId
    );
    await post.save();
    await post.populate('comments.user', 'fullName avatar');

    res.json({ success: true, data: post.comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleCommentReaction = async (req, res) => {
  try {
    const { type } = req.body;
    const validTypes = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'];
    if (!validTypes.includes(type)) return res.status(400).json({ success: false, message: 'Invalid reaction type' });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const hasReacted = comment.reactions[type].includes(req.userId);

    validTypes.forEach((t) => {
      comment.reactions[t] = comment.reactions[t].filter((id) => id.toString() !== req.userId);
    });

    if (!hasReacted) comment.reactions[type].push(req.userId);

    await post.save();
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
    if (alreadyReported) return res.status(400).json({ success: false, message: 'Bạn đã báo cáo bình luận này' });

    comment.reportedBy = comment.reportedBy || [];
    comment.reportedBy.push({ user: req.userId, reason });
    await post.save();

    res.json({ success: true, data: null, message: 'Đã ghi nhận báo cáo' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllPosts,
  getPostBySlug,
  getUserPosts,
  createPost,
  updatePost,
  deletePost,
  likePost,
  bookmarkPost,
  reportPost,
  addComment,
  deleteComment,
  toggleCommentReaction,
  reportComment
};