// modules/faq/faq.controller.js
const faqService = require('./faq.service');
const FAQ = require('./faq.model');

class FAQController {
    async getQuestions(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 10, 50);
            const category = req.query.category || null;
            const status = req.query.status || null;
            const search = req.query.search || '';

            const result = await faqService.getQuestions(page, limit, category, status, search);

            res.json({
                success: true,
                data: result.questions,
                stats: result.stats,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get questions error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getStats(req, res) {
        try {
            const stats = await FAQ.getStats();
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Get stats error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getRelatedQuestions(req, res) {
        try {
            const { content } = req.query;
            if (!content) {
                return res.json({ success: true, data: [] });
            }
            const questions = await faqService.getRelatedQuestions(content, 5);
            res.json({
                success: true,
                data: questions
            });
        } catch (error) {
            console.error('Get related questions error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getQuestionById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const question = await faqService.getQuestionById(id, userId);

            res.json({
                success: true,
                data: question
            });
        } catch (error) {
            console.error('Get question error:', error);
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }

    async createQuestion(req, res) {
        try {
            const userId = req.userId;
            const { title, content, category, tags } = req.body;

            const question = await faqService.createQuestion(userId, {
                title, content, category, tags
            });

            res.status(201).json({
                success: true,
                message: 'Câu hỏi đã được gửi. AI đã trả lời bạn! 🤖',
                data: question
            });
        } catch (error) {
            console.error('Create question error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async addAnswer(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const { content } = req.body;
            const isAdmin = req.userRole === 'admin';
            const userType = isAdmin ? 'admin' : 'user';

            const answer = await faqService.addAnswer(id, userId, content, userType);

            res.status(201).json({
                success: true,
                message: 'Đã thêm câu trả lời',
                data: answer
            });
        } catch (error) {
            console.error('Add answer error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async markBestAnswer(req, res) {
        try {
            const { id, answerId } = req.params;
            const userId = req.userId;
            const isAdmin = req.userRole === 'admin';

            const question = await faqService.markBestAnswer(id, answerId, userId, isAdmin);

            res.json({
                success: true,
                message: 'Đã đánh dấu câu trả lời hay nhất',
                data: question
            });
        } catch (error) {
            console.error('Mark best answer error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async likeAnswer(req, res) {
        try {
            const { id, answerId } = req.params;
            const userId = req.userId;

            const result = await faqService.likeAnswer(id, answerId, userId);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Like answer error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async markHelpful(req, res) {
        try {
            const { id } = req.params;
            const { helpful } = req.body;
            const userId = req.userId;

            const result = await faqService.markHelpful(id, helpful, userId);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Mark helpful error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async deleteQuestion(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const isAdmin = req.userRole === 'admin';

            await faqService.deleteQuestion(id, userId, isAdmin);

            res.json({
                success: true,
                message: 'Xóa câu hỏi thành công'
            });
        } catch (error) {
            console.error('Delete question error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async deleteAnswer(req, res) {
        try {
            const { id, answerId } = req.params;
            const userId = req.userId;
            const isAdmin = req.userRole === 'admin';

            await faqService.deleteAnswer(id, answerId, userId, isAdmin);

            res.json({
                success: true,
                message: 'Xóa câu trả lời thành công'
            });
        } catch (error) {
            console.error('Delete answer error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getUserQuestions(req, res) {
        try {
            const userId = req.userId;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 10, 50);

            const result = await faqService.getUserQuestions(userId, page, limit);

            res.json({
                success: true,
                data: result.questions,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get user questions error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new FAQController();