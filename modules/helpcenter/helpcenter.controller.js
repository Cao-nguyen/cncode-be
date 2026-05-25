// modules/helpcenter/helpcenter.controller.js
const HelpCenter = require('./helpcenter.model');

class HelpCenterController {
    // ========== USER ROUTES ==========

    // Lấy danh sách câu hỏi (public)
    async getFAQs(req, res) {
        try {
            const { category, search, page = 1, limit = 50 } = req.query;

            let query = { isActive: true };
            if (category && category !== 'all') {
                query.category = category;
            }
            if (search) {
                query.$text = { $search: search };
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [faqs, total] = await Promise.all([
                HelpCenter.find(query)
                    .sort({ order: 1, createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                HelpCenter.countDocuments(query)
            ]);

            // Lấy user đã like
            const userId = req.userId;
            if (userId && faqs.length > 0) {
                faqs.forEach(faq => {
                    faq.userLiked = faq.helpfulUsers?.some(
                        uid => uid.toString() === userId.toString()
                    ) || false;
                });
            }

            res.json({
                success: true,
                data: faqs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (error) {
            console.error('Get FAQs error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Lấy chi tiết câu hỏi
    async getFAQById(req, res) {
        try {
            const { id } = req.params;

            // Tăng view count
            await HelpCenter.findByIdAndUpdate(id, { $inc: { views: 1 } });

            const faq = await HelpCenter.findById(id).lean();
            if (!faq) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy câu hỏi'
                });
            }

            if (req.userId) {
                faq.userLiked = faq.helpfulUsers?.some(
                    uid => uid.toString() === req.userId.toString()
                ) || false;
            }

            res.json({
                success: true,
                data: faq
            });
        } catch (error) {
            console.error('Get FAQ error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Like/Unlike câu hỏi
    async toggleHelpful(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;

            const faq = await HelpCenter.findById(id);
            if (!faq) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy câu hỷi'
                });
            }

            const hasLiked = faq.helpfulUsers.includes(userId);

            if (hasLiked) {
                // Unlike
                faq.helpfulCount -= 1;
                faq.helpfulUsers = faq.helpfulUsers.filter(
                    uid => uid.toString() !== userId
                );
            } else {
                // Like
                faq.helpfulCount += 1;
                faq.helpfulUsers.push(userId);
            }

            await faq.save();

            res.json({
                success: true,
                data: {
                    helpfulCount: faq.helpfulCount,
                    userLiked: !hasLiked
                }
            });
        } catch (error) {
            console.error('Toggle helpful error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // ========== ADMIN ROUTES ==========

    // Lấy tất cả câu hỏi (admin)
    async getAllFAQs(req, res) {
        try {
            const { category, search, page = 1, limit = 20 } = req.query;

            let query = {};
            if (category && category !== 'all') {
                query.category = category;
            }
            if (search) {
                query.$or = [
                    { question: { $regex: search, $options: 'i' } },
                    { answer: { $regex: search, $options: 'i' } }
                ];
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [faqs, total] = await Promise.all([
                HelpCenter.find(query)
                    .populate('createdBy', 'fullName email')
                    .populate('updatedBy', 'fullName email')
                    .sort({ order: 1, createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                HelpCenter.countDocuments(query)
            ]);

            res.json({
                success: true,
                data: faqs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (error) {
            console.error('Get all FAQs error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Tạo câu hỏi mới
    async createFAQ(req, res) {
        try {
            const { question, answer, category, order } = req.body;
            const userId = req.userId;

            if (!question || !question.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng nhập câu hỏi'
                });
            }
            if (!answer || !answer.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng nhập câu trả lời'
                });
            }

            const faq = new HelpCenter({
                question: question.trim(),
                answer: answer.trim(),
                category: category || 'other',
                order: order || 0,
                createdBy: userId,
                updatedBy: userId
            });

            await faq.save();

            res.status(201).json({
                success: true,
                message: 'Tạo câu hỏi thành công',
                data: faq
            });
        } catch (error) {
            console.error('Create FAQ error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Cập nhật câu hỏi
    async updateFAQ(req, res) {
        try {
            const { id } = req.params;
            const { question, answer, category, order, isActive } = req.body;
            const userId = req.userId;

            const faq = await HelpCenter.findById(id);
            if (!faq) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy câu hỏi'
                });
            }

            if (question !== undefined) faq.question = question.trim();
            if (answer !== undefined) faq.answer = answer.trim();
            if (category !== undefined) faq.category = category;
            if (order !== undefined) faq.order = order;
            if (isActive !== undefined) faq.isActive = isActive;
            faq.updatedBy = userId;

            await faq.save();

            res.json({
                success: true,
                message: 'Cập nhật thành công',
                data: faq
            });
        } catch (error) {
            console.error('Update FAQ error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Xóa câu hỏi
    async deleteFAQ(req, res) {
        try {
            const { id } = req.params;

            const faq = await HelpCenter.findByIdAndDelete(id);
            if (!faq) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy câu hỏi'
                });
            }

            res.json({
                success: true,
                message: 'Xóa câu hỏi thành công'
            });
        } catch (error) {
            console.error('Delete FAQ error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Cập nhật thứ tự
    async updateOrder(req, res) {
        try {
            const { orders } = req.body; // [{ id, order }]

            for (const item of orders) {
                await HelpCenter.findByIdAndUpdate(item.id, { order: item.order });
            }

            res.json({
                success: true,
                message: 'Cập nhật thứ tự thành công'
            });
        } catch (error) {
            console.error('Update order error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Lấy thống kê
    async getStats(req, res) {
        try {
            const [total, active, inactive, byCategory] = await Promise.all([
                HelpCenter.countDocuments(),
                HelpCenter.countDocuments({ isActive: true }),
                HelpCenter.countDocuments({ isActive: false }),
                HelpCenter.aggregate([
                    { $group: { _id: '$category', count: { $sum: 1 } } }
                ])
            ]);

            const categoryStats = {};
            byCategory.forEach(item => {
                categoryStats[item._id] = item.count;
            });

            res.json({
                success: true,
                data: {
                    total,
                    active,
                    inactive,
                    byCategory: categoryStats
                }
            });
        } catch (error) {
            console.error('Get stats error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new HelpCenterController();