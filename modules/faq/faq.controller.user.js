const service = require('./faq.service.user');

const createQuestion = async (req, res) => {
    try {
        const { title, content, grade, isAnonymous } = req.body;
        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Tiêu đề và nội dung là bắt buộc' });
        }
        const question = await service.createQuestion(req.userId, { title, content, grade, isAnonymous });
        res.status(201).json({ success: true, data: question });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

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

const toggleLikeQuestion = async (req, res) => {
    try {
        const result = await service.toggleLikeQuestion(req.params.id, req.userId);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateQuestion = async (req, res) => {
    try {
        const { title, content } = req.body;
        const question = await service.updateQuestion(req.params.id, req.userId, { title, content });
        res.json({ success: true, data: question });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const createAnswer = async (req, res) => {
    try {
        const { questionId, content } = req.body;
        if (!content) {
            return res.status(400).json({ success: false, message: 'Nội dung trả lời là bắt buộc' });
        }
        const answer = await service.createAnswer(questionId, req.userId, content);
        res.status(201).json({ success: true, data: answer });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const markBestAnswer = async (req, res) => {
    try {
        const { answerId, questionId } = req.body;
        const answer = await service.markBestAnswer(answerId, questionId, req.userId);
        res.json({ success: true, data: answer });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const toggleLikeAnswer = async (req, res) => {
    try {
        const result = await service.toggleLikeAnswer(req.params.id, req.userId);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const deleteQuestion = async (req, res) => {
    try {
        await service.deleteQuestion(req.params.id, req.userId);
        res.json({ success: true, message: 'Xóa câu hỏi thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const deleteAnswer = async (req, res) => {
    try {
        await service.deleteAnswer(req.params.id, req.userId);
        res.json({ success: true, message: 'Xóa câu trả lời thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const report = async (req, res) => {
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
};

const getStatistics = async (req, res) => {
    try {
        const { Question, Answer, QuestionLike } = require('./faq.model');
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [totalQuestions, answeredQuestions, totalAnswers, totalLikes, todayQuestions] = await Promise.all([
            Question.countDocuments(),
            Question.countDocuments({ answerCount: { $gt: 0 } }),
            Answer.countDocuments(),
            QuestionLike.countDocuments(),
            Question.countDocuments({ createdAt: { $gte: startOfToday } }),
        ]);

        const stats = {
            totalQuestions,
            answeredQuestions,
            pendingQuestions: totalQuestions - answeredQuestions,
            totalAnswers,
            totalLikes,
            todayQuestions,
        };
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    createQuestion,
    getQuestions,
    getQuestionBySlug,
    incrementViewCount,
    toggleLikeQuestion,
    updateQuestion,
    createAnswer,
    markBestAnswer,
    toggleLikeAnswer,
    deleteQuestion,
    deleteAnswer,
    report,
    getStatistics,
};
