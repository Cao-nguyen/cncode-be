const { Blog } = require('./blog.model');
const { BlogLike, BlogBookmark } = require('./blog-interaction.model');

// Helper: Extract plain text from HTML/Markdown and limit to word count
function extractExcerpt(html, maxWords = 150) {
    if (!html) return '';

    let text = html;

    // Remove script and style tags completely
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
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
        .replace(/&[a-z]+;/gi, ''); // Remove other entities

    // Remove markdown syntax
    text = text.replace(/[#*_~`\[\]()]/g, '');
    text = text.replace(/!\[.*?\]\(.*?\)/g, ''); // Remove images
    text = text.replace(/\[.*?\]\(.*?\)/g, ''); // Remove links

    // Remove multiple spaces, tabs, newlines
    text = text.replace(/\s+/g, ' ');

    // Trim
    text = text.trim();

    // Limit by word count (150 words) AND character count (500 chars max)
    const words = text.split(/\s+/);
    if (words.length > maxWords) {
        text = words.slice(0, maxWords).join(' ');
    }

    // Ensure it doesn't exceed 500 characters (schema maxlength)
    if (text.length > 497) {
        text = text.substring(0, 497);
    }

    // Add ellipsis if truncated
    if (words.length > maxWords || text.length >= 497) {
        text = text.trim() + '...';
    }

    return text;
}

// Public: Get all published blogs
const getBlogs = async (req, res) => {
    try {
        const { page = 1, limit = 12, category, search, sort = '-publishedAt' } = req.query;
        const skip = (page - 1) * limit;

        const query = { isPublished: true };

        if (category && category !== 'all') {
            query.category = category;
        }

        if (search) {
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
                .limit(parseInt(limit))
                .lean(),
            Blog.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: blogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get blogs error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};


// Public: Get blog by slug (không tăng viewCount)
const getBlogBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const blog = await Blog.findOne({ slug, isPublished: true })
            .populate('author', 'fullName avatar email')
            .lean();

        if (!blog) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
        }

        res.json({ success: true, data: blog });
    } catch (error) {
        console.error('Get blog by slug error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Public: Increment view count (gọi khi user thoát khỏi trang)
const incrementViewCount = async (req, res) => {
    try {
        const { slug } = req.params;

        const blog = await Blog.findOneAndUpdate(
            { slug, isPublished: true },
            { $inc: { viewCount: 1 } },
            { new: true }
        );

        if (!blog) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
        }

        res.json({ success: true, viewCount: blog.viewCount });
    } catch (error) {
        console.error('Increment view count error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Public: Get related blogs
const getRelatedBlogs = async (req, res) => {
    try {
        const { slug } = req.params;
        const { limit = 4 } = req.query;

        const currentBlog = await Blog.findOne({ slug }).lean();
        if (!currentBlog) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
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
            .limit(parseInt(limit))
            .lean();

        res.json({ success: true, data: blogs });
    } catch (error) {
        console.error('Get related blogs error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Admin: Get blog stats
const getBlogStats = async (req, res) => {
    try {
        const [total, published, draft, totalViewsResult] = await Promise.all([
            Blog.countDocuments(),
            Blog.countDocuments({ isPublished: true }),
            Blog.countDocuments({ isPublished: false }),
            Blog.aggregate([
                { $group: { _id: null, totalViews: { $sum: '$viewCount' } } }
            ])
        ]);

        const totalViews = totalViewsResult[0]?.totalViews || 0;

        res.json({
            success: true,
            data: {
                total,
                published,
                draft,
                totalViews
            }
        });
    } catch (error) {
        console.error('Get blog stats error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Admin: Get blog growth chart data (last 10 days including today)
const getBlogGrowthChart = async (req, res) => {
    try {
        const daysCount = 10;

        // Get today's date at end of day
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        // Get start date (9 days ago + today = 10 days total)
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 9);
        startDate.setHours(0, 0, 0, 0);

        // Aggregate blogs by date (with Vietnam timezone)
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

        // Create map for quick lookup
        const dataMap = {};
        blogsByDate.forEach(item => {
            dataMap[item._id] = item.count;
        });

        // Fill in all 10 days (including dates with 0 blogs)
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

        res.json({ success: true, data: chartData });
    } catch (error) {
        console.error('Get blog growth chart error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Admin: Get top viewed blogs
const getTopViewedBlogs = async (req, res) => {
    try {
        const { limit = 5 } = req.query;

        const blogs = await Blog.find()
            .select('title viewCount thumbnail')
            .sort('-viewCount')
            .limit(parseInt(limit))
            .lean();

        res.json({ success: true, data: blogs });
    } catch (error) {
        console.error('Get top viewed blogs error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Admin: Get all blogs (including unpublished)
const getAllBlogsAdmin = async (req, res) => {
    try {
        console.log('🔍 [BLOG ADMIN] User ID:', req.userId);
        console.log('🔍 [BLOG ADMIN] User Role:', req.userRole);
        console.log('🔍 [BLOG ADMIN] Query params:', req.query);

        const { page = 1, limit = 20, search, category, isPublished } = req.query;
        const skip = (page - 1) * limit;

        const query = {};

        if (search) {
            // Normalize search term - remove Vietnamese accents for better matching
            const normalizeVietnamese = (str) => {
                return str
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/đ/g, 'd')
                    .replace(/Đ/g, 'D');
            };

            const normalizedSearch = normalizeVietnamese(search);

            // Create fuzzy regex: "tre" -> "t.*r.*e"
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

        const [blogs, total] = await Promise.all([
            Blog.find(query)
                .populate('author', 'fullName avatar email')
                .sort('-createdAt')
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Blog.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: blogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get all blogs admin error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Admin: Get blog by ID
const getBlogById = async (req, res) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findById(id)
            .populate('author', 'fullName avatar email')
            .lean();

        if (!blog) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
        }

        res.json({ success: true, data: blog });
    } catch (error) {
        console.error('Get blog by ID error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Admin: Create blog
const createBlog = async (req, res) => {
    try {
        const { title, thumbnail, excerpt, content, category, tags, isPublished } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Tiêu đề và nội dung là bắt buộc' });
        }

        // Auto-generate excerpt from content if not provided (150 words)
        const finalExcerpt = excerpt || extractExcerpt(content, 150);

        const blog = new Blog({
            title,
            thumbnail,
            excerpt: finalExcerpt,
            content,
            category,
            tags: tags || [],
            isPublished: isPublished || false,
            author: req.userId
        });

        await blog.save();

        res.status(201).json({ success: true, data: blog, message: 'Tạo bài viết thành công' });
    } catch (error) {
        console.error('Create blog error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Admin: Update blog
const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, thumbnail, excerpt, content, category, tags, isPublished, publishedAt } = req.body;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
        }

        if (title) blog.title = title;
        if (thumbnail !== undefined) blog.thumbnail = thumbnail;

        // Auto-generate excerpt if content changed but excerpt not provided (150 words)
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

        await blog.save();

        res.json({ success: true, data: blog, message: 'Cập nhật bài viết thành công' });
    } catch (error) {
        console.error('Update blog error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Admin: Delete blog
const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findByIdAndDelete(id);
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
        }

        res.json({ success: true, message: 'Xóa bài viết thành công' });
    } catch (error) {
        console.error('Delete blog error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Admin: Toggle publish status
const togglePublish = async (req, res) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
        }

        blog.isPublished = !blog.isPublished;
        if (blog.isPublished && !blog.publishedAt) {
            blog.publishedAt = new Date();
        }

        await blog.save();

        res.json({
            success: true,
            data: blog,
            message: blog.isPublished ? 'Đã xuất bản bài viết' : 'Đã ẩn bài viết'
        });
    } catch (error) {
        console.error('Toggle publish error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// User: Toggle like blog
const toggleLikeBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
        }

        const existingLike = await BlogLike.findOne({ blogId: id, userId });

        if (existingLike) {
            // Unlike
            await BlogLike.deleteOne({ _id: existingLike._id });
            await Blog.findByIdAndUpdate(id, { $inc: { likeCount: -1 } });
            res.json({ success: true, liked: false, message: 'Đã bỏ thích' });
        } else {
            // Like
            await BlogLike.create({ blogId: id, userId });
            await Blog.findByIdAndUpdate(id, { $inc: { likeCount: 1 } });
            res.json({ success: true, liked: true, message: 'Đã thích bài viết' });
        }
    } catch (error) {
        console.error('Toggle like blog error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// User: Toggle bookmark blog
const toggleBookmarkBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
        }

        const existingBookmark = await BlogBookmark.findOne({ blogId: id, userId });

        if (existingBookmark) {
            // Remove bookmark
            await BlogBookmark.deleteOne({ _id: existingBookmark._id });
            res.json({ success: true, bookmarked: false, message: 'Đã bỏ lưu' });
        } else {
            // Add bookmark
            await BlogBookmark.create({ blogId: id, userId });
            res.json({ success: true, bookmarked: true, message: 'Đã lưu bài viết' });
        }
    } catch (error) {
        console.error('Toggle bookmark blog error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// User: Check if user liked/bookmarked blog
const checkBlogInteraction = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        const [liked, bookmarked] = await Promise.all([
            BlogLike.exists({ blogId: id, userId }),
            BlogBookmark.exists({ blogId: id, userId })
        ]);

        res.json({
            success: true,
            data: {
                liked: !!liked,
                bookmarked: !!bookmarked
            }
        });
    } catch (error) {
        console.error('Check blog interaction error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// User: Get my blogs
const getMyBlogs = async (req, res) => {
    try {
        const { page = 1, limit = 12 } = req.query;
        const skip = (page - 1) * limit;
        const userId = req.userId;

        const [blogs, total] = await Promise.all([
            Blog.find({ author: userId })
                .sort('-createdAt')
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Blog.countDocuments({ author: userId })
        ]);

        res.json({
            success: true,
            data: blogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get my blogs error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// User: Get my bookmarked blogs
const getMyBookmarkedBlogs = async (req, res) => {
    try {
        const { page = 1, limit = 12 } = req.query;
        const skip = (page - 1) * limit;
        const userId = req.userId;

        const bookmarks = await BlogBookmark.find({ userId })
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit))
            .populate({
                path: 'blogId',
                populate: { path: 'author', select: 'fullName avatar' }
            })
            .lean();

        const total = await BlogBookmark.countDocuments({ userId });

        const blogs = bookmarks.map(b => b.blogId).filter(b => b);

        res.json({
            success: true,
            data: blogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get bookmarked blogs error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Admin: Get top liked blogs
const getTopLikedBlogs = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const blogs = await Blog.find({ isPublished: true })
            .sort('-likeCount')
            .limit(limit)
            .select('title likeCount thumbnail')
            .lean();

        res.json({ success: true, data: blogs });
    } catch (error) {
        console.error('Get top liked blogs error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    getBlogs,
    getBlogBySlug,
    incrementViewCount,
    getRelatedBlogs,
    getBlogStats,
    getBlogGrowthChart,
    getTopViewedBlogs,
    getTopLikedBlogs,
    getAllBlogsAdmin,
    getBlogById,
    createBlog,
    updateBlog,
    deleteBlog,
    togglePublish,
    toggleLikeBlog,
    toggleBookmarkBlog,
    checkBlogInteraction,
    getMyBlogs,
    getMyBookmarkedBlogs
};
