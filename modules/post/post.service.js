const Post = require('./post.model');
const { deleteImage } = require('../../utils/cloudinary');

const createPost = async (postData, authorId) => {
  const readTime = Math.ceil(postData.content.length / 1000);
  const post = new Post({
    ...postData,
    author: authorId,
    readTime,
    status: 'pending'
  });
  await post.save();
  return post;
};

const getPosts = async (filters) => {
  const { category, search, sort, page = 1, limit = 10, status = 'published' } = filters;
  let query = { status };

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

  const skip = (page - 1) * limit;
  const posts = await Post.find(query)
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .populate('author', 'fullName avatar');

  const total = await Post.countDocuments(query);

  return { posts, total, page, totalPages: Math.ceil(total / limit) };
};

const getPostBySlug = async (slug) => {
  const post = await Post.findOne({ slug, status: 'published' })
    .populate('author', 'fullName avatar bio');

  if (!post) {
    throw new Error('Post not found');
  }

  await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });
  return post;
};

const getPostById = async (postId, userId) => {
  const post = await Post.findOne({ _id: postId, author: userId });
  if (!post) {
    throw new Error('Post not found');
  }
  return post;
};

const getUserPosts = async (userId) => {
  const posts = await Post.find({ author: userId })
    .sort({ createdAt: -1 });
  return posts;
};

const updatePost = async (postId, updateData, userId) => {
  const post = await Post.findOne({ _id: postId, author: userId });
  if (!post) {
    throw new Error('Post not found or unauthorized');
  }

  Object.assign(post, updateData);
  await post.save();
  return post;
};

const deletePost = async (postId, userId) => {
  const post = await Post.findOne({ _id: postId, author: userId });
  if (!post) {
    throw new Error('Post not found or unauthorized');
  }

  
  if (post.thumbnail) {
    await deleteImage(post.thumbnail);
  }

  await post.deleteOne();
  return post;
};

const likePost = async (postId, userId) => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new Error('Post not found');
  }

  const hasLiked = post.likedBy.includes(userId);
  if (hasLiked) {
    post.likedBy = post.likedBy.filter(id => id.toString() !== userId);
    post.likes = Math.max(0, post.likes - 1);
  } else {
    post.likedBy.push(userId);
    post.likes += 1;
  }

  await post.save();
  return { liked: !hasLiked, likes: post.likes };
};

const addComment = async (postId, userId, content) => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new Error('Post not found');
  }

  post.comments.push({ user: userId, content });
  await post.save();

  const updatedPost = await Post.findById(postId)
    .populate('comments.user', 'fullName avatar');

  return updatedPost.comments;
};

module.exports = {
  createPost,
  getPosts,
  getPostBySlug,
  getPostById,
  getUserPosts,
  updatePost,
  deletePost,
  likePost,
  addComment
};