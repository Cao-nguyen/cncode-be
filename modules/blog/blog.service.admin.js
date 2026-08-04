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

async function getAllBlogs(page = 1, limit = 20, search = null, category = null, isPublished = null) {
    const skip = (page - 1) * limit;

    const query = {};

    if (search) {
        const normalizeVietnamese = (str) => {
            return str
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .replace(/Đ/g, 'D');
        };

        const normalizedSearch = normalizeVietnamese(search);
        const fuzzyPattern = normalizedSearch
            .split('')
            .map(char => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*');

        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { excerpt: { $regex: search, $options: 'i' } },
            { title: { $regex: normalizedSearch, $options: 'i' } },
            { excerpt: { $regex: normalizedSearch, $options: 'i' } },
            { title: { $regex: fuzzyPattern, $options: 'i' } },
            { excerpt: { $regex: fuzzyPattern, $options: 'i' } }
        ];
    }

    if (category && category !== 'all') {
        query.category = category;
    }

    if (isPublished !== undefined && isPublished !== 'all') {
        query.isPublished = isPublished === 'true';
    }

    const [blogs, total, categoryStats, publishStats] = await Promise.all([
        Blog.find(query)
            .populate('author', 'fullName avatar email')
            .sort('-createdAt')
            .skip(skip)
            .limit(limit)
            .lean(),
        Blog.countDocuments(query),
        Blog.getCategoryStats(),
        Blog.getPublishStatusStats()
    ]);

    return {
        blogs,
        categoryStats,
        publishStats,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

async function getBlogById(blogId) {
    const blog = await Blog.findById(blogId)
        .populate('author', 'fullName avatar email')
        .lean();

    if (!blog) {
        throw new Error('Không tìm thấy bài viết');
    }

    return blog;
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

    const io = getIo();
    if (io) {
        io.emit('blog_created', blog);
    }

    return blog;
}

async function updateBlog(blogId, data) {
    const { title, thumbnail, excerpt, content, category, tags, isPublished, publishedAt, rejectionReason, needsReview } = data;

    const blog = await Blog.findById(blogId);
    if (!blog) {
        throw new Error('Không tìm thấy bài viết');
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
    if (publishedAt !== undefined) blog.publishedAt = publishedAt ? new Date(publishedAt) : null;
    if (rejectionReason !== undefined) blog.rejectionReason = rejectionReason;
    if (needsReview !== undefined) blog.needsReview = needsReview;

    await blog.save();
    await blog.populate('author', 'fullName avatar email');

    const io = getIo();
    if (io) {
        io.emit('blog_updated', blog);
    }

    return blog;
}

async function deleteBlog(blogId) {
    const blog = await Blog.findById(blogId);

    if (!blog) {
        throw new Error('Không tìm thấy bài viết');
    }

    await Blog.findByIdAndDelete(blogId);

    const io = getIo();
    if (io) {
        io.emit('blog_deleted', blogId);
    }

    return { success: true };
}

async function togglePublish(blogId) {
    const blog = await Blog.findById(blogId);
    if (!blog) {
        throw new Error('Không tìm thấy bài viết');
    }

    blog.isPublished = !blog.isPublished;
    if (blog.isPublished && !blog.publishedAt) {
        blog.publishedAt = new Date();
    }

    await blog.save();
    await blog.populate('author', 'fullName avatar email');

    // Notify author if published
    if (blog.isPublished) {
        const notificationContent = `Bài viết "${blog.title.substring(0, 50)}${blog.title.length > 50 ? '...' : ''}" của bạn đã được xuất bản`;

        const notification = await Notification.create({
            userId: blog.author,
            senderId: blog.author,
            type: 'system',
            content: notificationContent,
            meta: { blogId, action: 'published' },
            read: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const io = getIo();
        if (io) {
            const authorIdStr = typeof blog.author === 'object' ? blog.author._id.toString() : blog.author.toString();
            io.to(authorIdStr).emit('new_notification', {
                _id: notification._id,
                userId: blog.author,
                senderId: blog.author,
                type: 'system',
                content: notificationContent,
                meta: { blogId, action: 'published' },
                read: false,
                createdAt: notification.createdAt
            });
        }
    }

    const io = getIo();
    if (io) {
        io.emit('blog_updated', blog);
    }

    return blog;
}

async function getStats() {
    const [total, published, draft, totalViewsResult] = await Promise.all([
        Blog.countDocuments(),
        Blog.countDocuments({ isPublished: true }),
        Blog.countDocuments({ isPublished: false }),
        Blog.aggregate([
            { $group: { _id: null, totalViews: { $sum: '$viewCount' } } }
        ])
    ]);

    const totalViews = totalViewsResult[0]?.totalViews || 0;

    return {
        total,
        published,
        draft,
        totalViews
    };
}

async function getGrowthChart(daysCount = 10) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (daysCount - 1));
    startDate.setHours(0, 0, 0, 0);

    const blogsByDate = await Blog.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: today }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$createdAt',
                        timezone: 'Asia/Ho_Chi_Minh'
                    }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const dataMap = {};
    blogsByDate.forEach(item => {
        dataMap[item._id] = item.count;
    });

    const chartData = [];
    const currentDate = new Date(startDate);

    for (let i = 0; i < daysCount; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        chartData.push({
            date: dateStr,
            count: dataMap[dateStr] || 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return chartData;
}

async function getTopViewedBlogs(limit = 5) {
    const blogs = await Blog.find()
        .select('title viewCount thumbnail')
        .sort('-viewCount')
        .limit(limit)
        .lean();

    return blogs;
}

async function getTopLikedBlogs(limit = 5) {
    const blogs = await Blog.find({ isPublished: true })
        .sort('-likeCount')
        .limit(limit)
        .select('title likeCount thumbnail')
        .lean();

    return blogs;
}

module.exports = {
    getAllBlogs,
    getBlogById,
    createBlog,
    updateBlog,
    deleteBlog,
    togglePublish,
    getStats,
    getGrowthChart,
    getTopViewedBlogs,
    getTopLikedBlogs
};
