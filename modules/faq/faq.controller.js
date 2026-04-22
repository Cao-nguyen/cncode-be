// modules/faq/faq.controller.js
const faqService = require('./faq.service');

// Public: Lấy danh sách FAQ
const getFAQs = async (req, res) => {
    try {
        const { category, search, page = 1, limit = 50 } = req.query;
        const result = await faqService.getAllFAQs(
            { category, search, isActive: true },
            parseInt(page),
            parseInt(limit)
        );

        res.status(200).json({
            success: true,
            data: result.faqs,
            pagination: {
                page: result.page,
                limit: parseInt(limit),
                total: result.total,
                totalPages: result.totalPages
            }
        });
    } catch (error) {
        console.error('Get FAQs error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Public: Lấy chi tiết FAQ
const getFAQById = async (req, res) => {
    try {
        const { id } = req.params;
        const faq = await faqService.getFAQById(id);
        await faqService.incrementView(id);

        res.status(200).json({
            success: true,
            data: faq
        });
    } catch (error) {
        console.error('Get FAQ by id error:', error);
        res.status(404).json({ success: false, message: error.message });
    }
};

// Public: Đánh giá hữu ích
const rateHelpful = async (req, res) => {
    try {
        const { id } = req.params;
        const { helpful } = req.body;
        const result = await faqService.updateHelpful(id, helpful);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Rate helpful error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAllFAQsAdmin = async (req, res) => {
    try {
        const { category, search, page = 1, limit = 50, isActive = 'all' } = req.query;
        const result = await faqService.getAllFAQs(
            { category, search, isActive },
            parseInt(page),
            parseInt(limit)
        );

        res.status(200).json({
            success: true,
            data: result.faqs,
            pagination: {
                page: result.page,
                limit: parseInt(limit),
                total: result.total,
                totalPages: result.totalPages
            }
        });
    } catch (error) {
        console.error('Get all FAQs admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Tạo FAQ
const createFAQ = async (req, res) => {
    try {
        const { question, answer, category, order, isActive } = req.body;
        const userId = req.userId;

        if (!question || !answer) {
            return res.status(400).json({ success: false, message: 'Thiếu câu hỏi hoặc câu trả lời' });
        }

        const faq = await faqService.createFAQ({
            question,
            answer,
            category: category || 'general',
            order: order || 0,
            isActive: isActive !== undefined ? isActive : true
        }, userId);

        res.status(201).json({
            success: true,
            data: faq,
            message: 'Tạo câu hỏi thành công'
        });
    } catch (error) {
        console.error('Create FAQ error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Cập nhật FAQ
const updateFAQ = async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer, category, order, isActive } = req.body;
        const userId = req.userId;

        const faq = await faqService.updateFAQ(id, {
            question,
            answer,
            category,
            order,
            isActive
        }, userId);

        res.status(200).json({
            success: true,
            data: faq,
            message: 'Cập nhật câu hỏi thành công'
        });
    } catch (error) {
        console.error('Update FAQ error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Xóa FAQ
const deleteFAQ = async (req, res) => {
    try {
        const { id } = req.params;
        await faqService.deleteFAQ(id);

        res.status(200).json({
            success: true,
            message: 'Xóa câu hỏi thành công'
        });
    } catch (error) {
        console.error('Delete FAQ error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getFAQs,
    getFAQById,
    rateHelpful,
    getAllFAQsAdmin,
    createFAQ,
    updateFAQ,
    deleteFAQ
};