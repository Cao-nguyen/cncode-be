const service = require('./faq.service.admin');

const getQuestions = async (req, res) => {
    try {
        const result = await service.getQuestions({
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            grade: req.query.grade,
            search: req.query.search,
            status: req.query.status,
        }, req.userId || null);

        res.json({
            success: true,
            data: result.questions,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Admin get questions error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy danh sách câu hỏi' });
    }
};

const getQuestionBySlug = async (req, res) => {
    try {
        const { question, isLiked } = await service.getQuestionBySlug(req.params.slug, req.userId || null);
        const answers = await service.getAnswersByQuestion(question._id, req.userId || null);
        res.json({ success: true, data: { question, answers, isLiked } });
    } catch (error) {
        console.error('Admin get question error:', error);
        const status = error.message.includes('Không tìm thấy') ? 404 : 500;
        res.status(status).json({ success: false, message: error.message || 'Không tìm thấy câu hỏi' });
    }
};

const getStatistics = async (req, res) => {
    try {
        const stats = await service.getStatistics();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Admin get FAQ statistics error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy thống kê' });
    }
};

const updateAnswer = async (req, res) => {
    try {
        const { content } = req.body;
        if (!content?.trim()) {
            return res.status(400).json({ success: false, message: 'Nội dung trả lời là bắt buộc' });
        }
        const answer = await service.updateAnswer(req.params.id, req.userId, content);
        res.json({ success: true, data: answer, message: 'Cập nhật câu trả lời thành công' });
    } catch (error) {
        console.error('Admin update answer error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi cập nhật câu trả lời' });
    }
};

const togglePinQuestion = async (req, res) => {
    try {
        const question = await service.togglePinQuestion(req.params.id);
        res.json({ success: true, data: question, message: 'Cập nhật ghim thành công' });
    } catch (error) {
        console.error('Toggle pin question error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi ghim câu hỏi' });
    }
};

const toggleLockQuestion = async (req, res) => {
    try {
        const question = await service.toggleLockQuestion(req.params.id);
        res.json({ success: true, data: question, message: 'Cập nhật khóa thành công' });
    } catch (error) {
        console.error('Toggle lock question error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi khóa câu hỏi' });
    }
};

const deleteQuestion = async (req, res) => {
    try {
        await service.deleteQuestion(req.params.id);
        res.json({ success: true, message: 'Xóa câu hỏi thành công' });
    } catch (error) {
        console.error('Admin delete question error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi xóa câu hỏi' });
    }
};

const deleteAnswer = async (req, res) => {
    try {
        await service.deleteAnswer(req.params.id);
        res.json({ success: true, message: 'Xóa câu trả lời thành công' });
    } catch (error) {
        console.error('Admin delete answer error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi xóa câu trả lời' });
    }
};

module.exports = {
    getQuestions,
    getQuestionBySlug,
    getStatistics,
    updateAnswer,
    togglePinQuestion,
    toggleLockQuestion,
    deleteQuestion,
    deleteAnswer,
};
