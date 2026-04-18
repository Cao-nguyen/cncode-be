const Post = require('./post.model');
const User = require('../user/user.model');

const calculateReadTime = (content) => {
  const wordsPerMinute = 200;
  const text = content.replace(/<[^>]*>/g, '');
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
};

const generateSlug = (title) => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const createPost = async (req, res) => {
  try {
    const { title, description, content, thumbnail, category, tags, status } = req.body;
    const author = req.userId;

    if (!title || !description || !content || !category || !thumbnail) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }

    let slug = generateSlug(title);
    let existingPost = await Post.findOne({ slug });
    let counter = 1;

    while (existingPost) {
      slug = `${generateSlug(title)}-${counter}`;
      existingPost = await Post.findOne({ slug });
      counter++;
    }

    const readTime = calculateReadTime(content);

    const post = new Post({
      title,
      slug,
      description,
      content,
      thumbnail,
      category,
      tags: tags || [],
      author,
      readTime,
      status: status || 'draft'
    });

    await post.save();
    await post.populate('author', 'fullName email avatar');

    res.status(201).json({
      success: true,
      data: post,
      message: 'Tạo bài viết thành công'
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo bài viết' });
  }
};

const getAllPosts = async (req, res) => {
  try {
    const { page = 1, limit = 12, category, search, sort = 'newest', status = 'published' } = req.query;

    const query = { status };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOption = {};
    switch (sort) {
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'popular':
        sortOption = { views: -1 };
        break;
      case 'trending':
        sortOption = { likes: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('author', 'fullName email avatar')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit)),
      Post.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      message: 'Lấy danh sách bài viết thành công'
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách bài viết' });
  }
};

const getPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await Post.findOne({ slug, status: 'published' })
      .populate('author', 'fullName email avatar bio');

    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    await Post.updateOne({ slug }, { $inc: { views: 1 } });

    const commentsWithUser = await Promise.all(
      post.comments.map(async (comment) => {
        const user = await User.findById(comment.user).select('fullName email avatar');
        return {
          ...comment.toObject(),
          user
        };
      })
    );

    const buildCommentTree = (comments, parentId = null) => {
      return comments
        .filter(c => String(c.parentId) === String(parentId))
        .map(c => ({
          ...c,
          children: buildCommentTree(comments, c._id)
        }));
    };

    const commentTree = buildCommentTree(commentsWithUser);

    const postObj = post.toObject();
    postObj.comments = commentTree;

    res.status(200).json({
      success: true,
      data: postObj,
      message: 'Lấy bài viết thành công'
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy bài viết' });
  }
};

const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parentId = null } = req.body;
    const userId = req.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung bình luận không được để trống' });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    let replyToName = null;
    if (parentId) {
      const parentComment = post.comments.id(parentId);
      if (parentComment) {
        const parentUser = await User.findById(parentComment.user);
        replyToName = parentUser.fullName;
      }
    }

    const newComment = {
      user: userId,
      content: content.trim(),
      parentId,
      createdAt: new Date()
    };

    post.comments.push(newComment);
    await post.save();

    const user = await User.findById(userId).select('fullName email avatar');
    const addedComment = {
      ...newComment,
      _id: post.comments[post.comments.length - 1]._id,
      user,
      replyToName
    };

    const allCommentsWithUser = await Promise.all(
      post.comments.map(async (comment) => {
        const commentUser = await User.findById(comment.user).select('fullName email avatar');
        return {
          ...comment.toObject(),
          user: commentUser
        };
      })
    );

    const buildCommentTree = (comments, parentId = null) => {
      return comments
        .filter(c => String(c.parentId) === String(parentId))
        .map(c => ({
          ...c,
          children: buildCommentTree(comments, c._id)
        }));
    };

    const commentTree = buildCommentTree(allCommentsWithUser);

    const io = req.app.get('io');
    const users = req.app.get('users');

    if (post.author.toString() !== userId) {
      const authorSocketId = users.get(post.author.toString());
      if (authorSocketId) {
        io.to(authorSocketId).emit('new_notification', {
          type: 'comment',
          postId: post._id,
          postTitle: post.title,
          commentId: addedComment._id,
          userName: user.fullName,
          content: content.trim().substring(0, 100),
          createdAt: new Date()
        });
      }
    }

    res.status(201).json({
      success: true,
      data: commentTree,
      message: 'Thêm bình luận thành công'
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi thêm bình luận' });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.userId;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận' });
    }

    const isAuthor = post.author.toString() === userId;
    const isCommentOwner = comment.user.toString() === userId;
    const isAdmin = req.userRole === 'admin';

    if (!isAuthor && !isCommentOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa bình luận này' });
    }

    const deleteChildComments = (commentId) => {
      post.comments = post.comments.filter(c => String(c.parentId) !== String(commentId));
    };

    deleteChildComments(commentId);
    post.comments.pull(commentId);
    await post.save();

    const allCommentsWithUser = await Promise.all(
      post.comments.map(async (comment) => {
        const user = await User.findById(comment.user).select('fullName email avatar');
        return {
          ...comment.toObject(),
          user
        };
      })
    );

    const buildCommentTree = (comments, parentId = null) => {
      return comments
        .filter(c => String(c.parentId) === String(parentId))
        .map(c => ({
          ...c,
          children: buildCommentTree(comments, c._id)
        }));
    };

    const commentTree = buildCommentTree(allCommentsWithUser);

    res.status(200).json({
      success: true,
      data: commentTree,
      message: 'Xóa bình luận thành công'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa bình luận' });
  }
};

const toggleCommentReaction = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { type } = req.body;
    const userId = req.userId;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận' });
    }

    const reactionField = `reactions.${type}`;
    const currentReactions = comment.reactions[type] || [];

    if (currentReactions.includes(userId)) {
      comment.reactions[type] = currentReactions.filter(id => String(id) !== String(userId));
    } else {
      for (const key of Object.keys(comment.reactions)) {
        comment.reactions[key] = comment.reactions[key].filter(id => String(id) !== String(userId));
      }
      comment.reactions[type].push(userId);
    }

    await post.save();

    const io = req.app.get('io');
    const users = req.app.get('users');

    if (comment.user.toString() !== userId) {
      const commentOwnerSocketId = users.get(comment.user.toString());
      if (commentOwnerSocketId) {
        io.to(commentOwnerSocketId).emit('new_notification', {
          type: 'reaction',
          postId: post._id,
          postTitle: post.title,
          commentId: comment._id,
          reactionType: type,
          userName: (await User.findById(userId)).fullName,
          createdAt: new Date()
        });
      }
    }

    res.status(200).json({
      success: true,
      data: { type, hasReacted: comment.reactions[type].includes(userId) },
      message: 'Cập nhật cảm xúc thành công'
    });
  } catch (error) {
    console.error('Toggle comment reaction error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật cảm xúc' });
  }
};

const likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    const hasLiked = post.likedBy.includes(userId);

    if (hasLiked) {
      post.likedBy = post.likedBy.filter(id => String(id) !== String(userId));
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedBy.push(userId);
      post.likes += 1;
    }

    await post.save();

    res.status(200).json({
      success: true,
      data: { liked: !hasLiked, likes: post.likes },
      message: hasLiked ? 'Đã bỏ thích bài viết' : 'Đã thích bài viết'
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi thích bài viết' });
  }
};

const getUserPosts = async (req, res) => {
  try {
    const userId = req.userId;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { author: userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [posts, total] = await Promise.all([
      Post.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Post.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      message: 'Lấy bài viết của bạn thành công'
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy bài viết của bạn' });
  }
};

const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, thumbnail, category, tags, status } = req.body;
    const userId = req.userId;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    if (post.author.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền cập nhật bài viết này' });
    }

    if (title && title !== post.title) {
      let newSlug = generateSlug(title);
      let existingPost = await Post.findOne({ slug: newSlug, _id: { $ne: post._id } });
      let counter = 1;

      while (existingPost) {
        newSlug = `${generateSlug(title)}-${counter}`;
        existingPost = await Post.findOne({ slug: newSlug, _id: { $ne: post._id } });
        counter++;
      }

      post.slug = newSlug;
      post.title = title;
    }

    if (description) post.description = description;
    if (content) {
      post.content = content;
      post.readTime = calculateReadTime(content);
    }
    if (category) post.category = category;
    if (thumbnail) post.thumbnail = thumbnail;
    if (tags) post.tags = tags;
    if (status) post.status = status;

    await post.save();
    await post.populate('author', 'fullName email avatar');

    res.status(200).json({
      success: true,
      data: post,
      message: 'Cập nhật bài viết thành công'
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật bài viết' });
  }
};

const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    if (post.author.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa bài viết này' });
    }

    await post.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Xóa bài viết thành công'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa bài viết' });
  }
};

module.exports = {
  createPost,
  getAllPosts,
  getPostBySlug,
  addComment,
  deleteComment,
  toggleCommentReaction,
  likePost,
  getUserPosts,
  updatePost,
  deletePost
};