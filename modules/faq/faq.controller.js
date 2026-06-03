
const faqService = require('./faq.service');

module.exports = {

    async createQuestion(req, res) {
        try {
            const { title, content, grade, isAnonymous } = req.body;
            if (!title || !content) {
                return res.status(400).json({ success: false, message: 'Tiêu đề và nội dung là bắt buộc' });
            }
            const question = await faqService.createQuestion(req.userId, { title, content, grade, isAnonymous });
            res.status(201).json({ success: true, data: question });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getQuestions(req, res) {
        try {
            const { page, limit, grade, search } = req.query;
            const result = await faqService.getQuestions({
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                grade,
                search,
            }, req.userId);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getQuestionBySlug(req, res) {
        try {
            const { question, isLiked } = await faqService.getQuestionBySlug(req.params.slug, req.userId);
            const answers = await faqService.getAnswersByQuestion(question._id, req.userId);
            res.json({ success: true, data: { question, answers, isLiked } });
        } catch (error) {
            res.status(404).json({ success: false, message: error.message });
        }
    },

    async incrementViewCount(req, res) {
        try {
            const { slug } = req.params;
            const result = await faqService.incrementViewCount(slug);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(404).json({ success: false, message: error.message });
        }
    },

    async toggleLikeQuestion(req, res) {
        try {
            const result = await faqService.toggleLikeQuestion(req.params.id, req.userId);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async updateQuestion(req, res) {
        try {
            const { title, content } = req.body;
            const question = await faqService.updateQuestion(req.params.id, req.userId, { title, content });
            res.json({ success: true, data: question });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async updateAnswer(req, res) {
        try {
            const { content } = req.body;
            const isAdmin = req.userRole === 'admin';
            const answer = await faqService.updateAnswer(req.params.id, req.userId, content, isAdmin);
            res.json({ success: true, data: answer });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async createAnswer(req, res) {
        try {
            const { questionId, content } = req.body;
            if (!content) {
                return res.status(400).json({ success: false, message: 'Nội dung trả lời là bắt buộc' });
            }
            const answer = await faqService.createAnswer(questionId, req.userId, content);
            res.status(201).json({ success: true, data: answer });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async markBestAnswer(req, res) {
        try {
            const { answerId, questionId } = req.body;
            const answer = await faqService.markBestAnswer(answerId, questionId, req.userId);
            res.json({ success: true, data: answer });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async toggleLikeAnswer(req, res) {
        try {
            const result = await faqService.toggleLikeAnswer(req.params.id, req.userId);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async togglePinQuestion(req, res) {
        try {
            const question = await faqService.togglePinQuestion(req.params.id);
            res.json({ success: true, data: question });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async toggleLockQuestion(req, res) {
        try {
            const question = await faqService.toggleLockQuestion(req.params.id);
            res.json({ success: true, data: question });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async deleteQuestion(req, res) {
        try {

            const isAdmin = req.userRole === 'admin';
            await faqService.deleteQuestion(req.params.id, req.userId, isAdmin);
            res.json({ success: true, message: 'Xóa câu hỏi thành công' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async deleteAnswer(req, res) {
        try {

            const isAdmin = req.userRole === 'admin';
            await faqService.deleteAnswer(req.params.id, req.userId, isAdmin);
            res.json({ success: true, message: 'Xóa câu trả lời thành công' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getStatistics(req, res) {
        try {
            const stats = await faqService.getStatistics();
            res.json({ success: true, data: stats });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async report(req, res) {
        try {
            const { type, targetId, reason, description } = req.body;
            const userId = req.userId;

            console.log(`Report received: 
            User: ${userId}
            Type: ${type}
            TargetId: ${targetId}
            Reason: ${reason}
            Description: ${description}
            Time: ${new Date().toISOString()}
        `);

            res.json({ success: true, message: 'Báo cáo đã được gửi' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
};
