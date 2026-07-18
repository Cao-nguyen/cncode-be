const service = require('./faq.service.admin');

const getQuestions = async (req, res) => {
    try {
        const { page, limit, grade, search } = req.query;
        const result = await service.getQuestions({
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
            grade,
            search,
        }, req.userId);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getQuestionBySlug = async (req, res) => {
    try {
        const { question, isLiked } = await service.getQuestionBySlug(req.params.slug, req.userId);
        const answers = await service.getAnswersByQuestion(question._id, req.userId);
        res.json({ success: true, data: { question, answers, isLiked } });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

const incrementViewCount = async (req, res) => {
    try {
        const { slug } = req.params;
        const result = await service.incrementViewCount(slug);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

const updateAnswer = async (req, res) => {
    try {
        const { content } = req.body;
        const answer = await service.updateAnswer(req.params.id, req.userId, content, true);
        res.json({ success: true, data: answer });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const togglePinQuestion = async (req, res) => {
    try {
        const question = await service.togglePinQuestion(req.params.id);
        res.json({ success: true, data: question });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const toggleLockQuestion = async (req, res) => {
    try {
        const question = await service.toggleLockQuestion(req.params.id);
        res.json({ success: true, data: question });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const deleteQuestion = async (req, res) => {
    try {
        await service.deleteQuestion(req.params.id);
        res.json({ success: true, message: 'Xóa câu hỏi thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const deleteAnswer = async (req, res) => {
    try {
        await service.deleteAnswer(req.params.id);
        res.json({ success: true, message: 'Xóa câu trả lời thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getStatistics = async (req, res) => {
    try {
        const stats = await service.getStatistics();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    getQuestions,
    getQuestionBySlug,
    incrementViewCount,
    updateAnswer,
    togglePinQuestion,
    toggleLockQuestion,
    deleteQuestion,
    deleteAnswer,
    getStatistics,
};
