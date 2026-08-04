const { Blog } = require('./blog.model');
const { BlogLike, BlogBookmark } = require('./blog-interaction.model');
const Notification = require('../notification/notification.model');
const User = require('../user/user.model');
const socketService = require('../../services/socket.service');

function getIo() {
    try {
        return socketService.getIO();
    } catch (e) {
        console.error('❌ Blog getIo error:', e.message);
        return null;
    }
}

// Helper: Normalize text for search
function normalizeText(text) {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
}

// Helper: Extract plain text from HTML/Markdown
function extractExcerpt(html, maxWords = 150) {
    if (!html) return '';

    let text = html;
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/'/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&hellip;/g, '...')
        .replace(/&[a-z]+;/gi, '');
    text = text.replace(/[#*_~`\[\]()]/g, '');
    text = text.replace(/!\[.*?\]\(.*?\)/g, '');
    text = text.replace(/\[.*?\]\(.*?\)/g, '');
    text = text.replace(/\s+/g, ' ');
    text = text.trim();

    const words = text.split(/\s+/);
    if (words.length > maxWords) {
        text = words.slice(0, maxWords).join(' ');
    }

    if (text.length > 497) {
        text = text.substring(0, 497);
    }

    if (words.length > maxWords || text.length >= 497) {
        text = text.trim() + '...';
    }

    return text;
}

async function getBlogs(page = 1, limit = 12, category = null, search = null, sort = '-publishedAt') {
    const skip = (page - 1) * limit;

    const query = { isPublished: true };

    if (category && category !== 'all') {
        query.category = category;
    }

    if (search) {
        const normalizedSearch = normalizeText(search);
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { excerpt: { $regex: search, $options: 'i' } },
            { tags: { $in: [new RegExp(search, 'i')] } }
        ];
    }

    const [blogs, total] = await Promise.all([
        Blog.find(query)
            .populate('author', 'fullName avatar')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        Blog.countDocuments(query)
    ]);

    return {
        blogs,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

async function getBlogBySlug(slug) {
    const blog = await Blog.findOne({ slug, isPublished: true })
        .populate('author', 'fullName avatar email')
        .lean();

    if (!blog) {
        throw new Error('Không tìm thấy bài viết');
    }

    return blog;
}

async function incrementViewCount(slug) {
    const blog = await Blog.findOneAndUpdate(
        { slug, isPublished: true },
        { $inc: { viewCount: 1 } },
        { new: true }
    );

    if (!blog) {
        throw new Error('Không tìm thấy bài viết');
    }

    return blog.viewCount;
}

async function getRelatedBlogs(slug, limit = 4) {
    const currentBlog = await Blog.findOne({ slug }).lean();
    if (!currentBlog) {
        throw new Error('Không tìm thấy bài viết');
    }

    const blogs = await Blog.find({
        _id: { $ne: currentBlog._id },
        isPublished: true,
        $or: [
            { category: currentBlog.category },
            { tags: { $in: currentBlog.tags } }
        ]
    })
        .populate('author', 'fullName avatar')
        .sort('-publishedAt')
        .limit(limit)
        .lean();

    return blogs;
}

async function createBlog(userId, data) {
    const { title, thumbnail, excerpt, content, category, tags, isPublished } = data;

    if (!title || !content) {
        throw new Error('Tiêu đề và nội dung là bắt buộc');
    }

    const finalExcerpt = excerpt || extractExcerpt(content, 150);

    const validCategories = ['technology', 'education', 'news', 'contest', 'other'];
    const finalCategory = validCategories.includes(category) ? category : 'other';

    const blog = new Blog({
        title,
        thumbnail,
        excerpt: finalExcerpt,
        content,
        category: finalCategory,
        tags: tags || [],
        isPublished: isPublished || false,
        author: userId
    });

    await blog.save();
    await blog.populate('author', 'fullName avatar email');

    // Notify admins if published
    if (isPublished) {
        const admins = await User.find({ role: 'admin' }).select('_id');
        const adminIds = admins.map(admin => admin._id);
        const io = getIo();

        if (adminIds.length > 0) {
            const user = await User.findById(userId).select('fullName');
            const notificationContent = `${user?.fullName || 'Người dùng'} vừa đăng bài viết mới: "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}"`;

            const notifications = await Notification.insertMany(
                adminIds.map(adminId => ({
                    userId: adminId,
                    senderId: userId,
                    type: 'system',
                    content: notificationContent,
                    meta: { blogId: blog._id, title, category: finalCategory },
                    read: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }))
            );

            if (io) {
                notifications.forEach((notification, index) => {
                    const adminId = adminIds[index].toString();
                    io.to(adminId).emit('new_notification', {
                        _id: notification._id,
                        userId: notification.userId,
                        senderId: userId,
                        type: 'system',
                        content: notificationContent,
                        meta: { blogId: blog._id, title, category: finalCategory },
                        read: false,
                        createdAt: notification.createdAt
                    });
                });
            }
        }
    }

    const io = getIo();
    if (io) {
        io.emit('blog_created', blog);
    }

    return blog;
}

async function updateBlog(blogId, userId, data) {
    const { title, thumbnail, excerpt, content, category, tags, isPublished } = data;

    const blog = await Blog.findById(blogId);
    if (!blog) {
        throw new Error('Không tìm thấy bài viết');
    }

    if (blog.author.toString() !== userId) {
        throw new Error('Bạn không có quyền chỉnh sửa bài viết này');
    }

    if (title) blog.title = title;
    if (thumbnail !== undefined) blog.thumbnail = thumbnail;

    if (content) {
        blog.content = content;
        if (excerpt === undefined) {
            blog.excerpt = extractExcerpt(content, 150);
        }
    }

    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (category) blog.category = category;
    if (tags !== undefined) blog.tags = tags;
    if (isPublished !== undefined) blog.isPublished = isPublished;

    await blog.save();
    await blog.populate('author', 'fullName avatar email');

    const io = getIo();
    if (io) {
        io.emit('blog_updated', blog);
    }

    return blog;
}

async function deleteBlog(blogId, userId) {
    const blog = await Blog.findById(blogId);

    if (!blog) {
        throw new Error('Không tìm thấy bài viết');
    }

    if (blog.author.toString() !== userId) {
        throw new Error('Bạn không có quyền xóa bài viết này');
    }

    await Blog.findByIdAndDelete(blogId);

    const io = getIo();
    if (io) {
        io.emit('blog_deleted', blogId);
    }

    return { success: true };
}

async function toggleLikeBlog(blogId, userId) {
    const blog = await Blog.findById(blogId);
    if (!blog) {
        throw new Error('Không tìm thấy bài viết');
    }

    const existingLike = await BlogLike.findOne({ blogId, userId });

    if (existingLike) {
        await BlogLike.deleteOne({ _id: existingLike._id });
        await Blog.findByIdAndUpdate(blogId, { $inc: { likeCount: -1 } });
        return { liked: false, action: 'unliked' };
    } else {
        await BlogLike.create({ blogId, userId });
        await Blog.findByIdAndUpdate(blogId, { $inc: { likeCount: 1 } });

        // Notify author
        if (blog.author.toString() !== userId) {
            const liker = await User.findById(userId).select('fullName avatar');
            const notificationContent = `${liker?.fullName || 'Ai đó'} đã thích bài viết của bạn: "${blog.title.substring(0, 50)}${blog.title.length > 50 ? '...' : ''}"`;

            const notification = await Notification.create({
                userId: blog.author,
                senderId: userId,
                type: 'system',
                content: notificationContent,
                meta: { blogId, action: 'liked' },
                read: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const io = getIo();
            if (io) {
                io.to(blog.author.toString()).emit('new_notification', {
                    _id: notification._id,
                    userId: blog.author,
                    senderId: userId,
                    type: 'system',
                    content: notificationContent,
                    meta: { blogId, action: 'liked' },
                    read: false,
                    createdAt: notification.createdAt
                });
            }
        }

        return { liked: true, action: 'liked' };
    }
}

async function toggleBookmarkBlog(blogId, userId) {
    const blog = await Blog.findById(blogId);
    if (!blog) {
        throw new Error('Không tìm thấy bài viết');
    }

    const existingBookmark = await BlogBookmark.findOne({ blogId, userId });

    if (existingBookmark) {
        await BlogBookmark.deleteOne({ _id: existingBookmark._id });
        return { bookmarked: false, action: 'unbookmarked' };
    } else {
        await BlogBookmark.create({ blogId, userId });
        return { bookmarked: true, action: 'bookmarked' };
    }
}

async function checkBlogInteraction(blogId, userId) {
    const [liked, bookmarked] = await Promise.all([
        BlogLike.exists({ blogId, userId }),
        BlogBookmark.exists({ blogId, userId })
    ]);

    return {
        liked: !!liked,
        bookmarked: !!bookmarked
    };
}

async function getMyBlogs(userId, page = 1, limit = 12) {
    const skip = (page - 1) * limit;

    const [blogs, total] = await Promise.all([
        Blog.find({ author: userId })
            .sort('-createdAt')
            .skip(skip)
            .limit(limit)
            .lean(),
        Blog.countDocuments({ author: userId })
    ]);

    return {
        blogs,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

async function getMyBookmarkedBlogs(userId, page = 1, limit = 12) {
    const skip = (page - 1) * limit;

    const bookmarks = await BlogBookmark.find({ userId })
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .populate({
            path: 'blogId',
            populate: { path: 'author', select: 'fullName avatar' }
        })
        .lean();

    const total = await BlogBookmark.countDocuments({ userId });

    const blogs = bookmarks.map(b => b.blogId).filter(b => b);

    return {
        blogs,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

async function getMyBlogById(id, userId) {
    const blog = await Blog.findOne({ _id: id, author: userId })
        .populate('author', 'fullName avatar email')
        .lean();

    if (!blog) {
        throw new Error('Không tìm thấy bài viết hoặc bạn không có quyền truy cập');
    }

    return blog;
}

module.exports = {
    getBlogs,
    getBlogBySlug,
    incrementViewCount,
    getRelatedBlogs,
    createBlog,
    updateBlog,
    deleteBlog,
    toggleLikeBlog,
    toggleBookmarkBlog,
    checkBlogInteraction,
    getMyBlogs,
    getMyBookmarkedBlogs,
    getMyBlogById
};
