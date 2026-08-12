const service = require('./faq.service.user');

const createQuestion = async (req, res) => {
    try {
        const { title, content, grade, isAnonymous } = req.body;
        if (!title?.trim() || !content?.trim()) {
            return res.status(400).json({ success: false, message: 'Tiêu đề và nội dung là bắt buộc' });
        }

        const question = await service.createQuestion(req.userId, { title, content, grade, isAnonymous });
        res.status(201).json({ success: true, data: question, message: 'Đăng câu hỏi thành công' });
    } catch (error) {
        console.error('Create question error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi tạo câu hỏi' });
    }
};

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
        console.error('Get questions error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy danh sách câu hỏi' });
    }
};

const getPublicMeta = async (req, res) => {
    try {
        const meta = await service.getPublicQuestionMeta(req.params.slug);
        if (!meta) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi' });
        }
        res.json({ success: true, data: meta });
    } catch (error) {
        console.error('Get public FAQ meta error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy thông tin câu hỏi' });
    }
};

const getQuestionBySlug = async (req, res) => {
    try {
        const { question, isLiked } = await service.getQuestionBySlug(req.params.slug, req.userId || null);
        const answers = await service.getAnswersByQuestion(question._id, req.userId || null);
        res.json({ success: true, data: { question, answers, isLiked } });
    } catch (error) {
        console.error('Get question by slug error:', error);
        const status = error.message.includes('Không tìm thấy') ? 404 : 500;
        res.status(status).json({ success: false, message: error.message || 'Không tìm thấy câu hỏi' });
    }
};

const incrementViewCount = async (req, res) => {
    try {
        const result = await service.incrementViewCount(
            req.params.slug,
            req.userId || null,
            req.body?.guestId || null,
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Increment FAQ view error:', error);
        const status = error.message.includes('Không tìm thấy') ? 404 : 400;
        res.status(status).json({ success: false, message: error.message || 'Không thể cập nhật lượt xem' });
    }
};

const getStatistics = async (req, res) => {
    try {
        const stats = await service.getPublicStatistics();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get FAQ statistics error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi khi lấy thống kê' });
    }
};

const toggleLikeQuestion = async (req, res) => {
    try {
        const result = await service.toggleLikeQuestion(req.params.id, req.userId);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Toggle like question error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi cập nhật lượt thích' });
    }
};

const updateQuestion = async (req, res) => {
    try {
        const { title, content } = req.body;
        const question = await service.updateQuestion(req.params.id, req.userId, { title, content });
        res.json({ success: true, data: question, message: 'Cập nhật câu hỏi thành công' });
    } catch (error) {
        console.error('Update question error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi cập nhật câu hỏi' });
    }
};

const createAnswer = async (req, res) => {
    try {
        const { questionId, content } = req.body;
        if (!content?.trim()) {
            return res.status(400).json({ success: false, message: 'Nội dung trả lời là bắt buộc' });
        }
        const answer = await service.createAnswer(questionId, req.userId, content);
        res.status(201).json({ success: true, data: answer, message: 'Gửi câu trả lời thành công' });
    } catch (error) {
        console.error('Create answer error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi gửi câu trả lời' });
    }
};

const markBestAnswer = async (req, res) => {
    try {
        const { answerId, questionId } = req.body;
        const answer = await service.markBestAnswer(answerId, questionId, req.userId);
        res.json({ success: true, data: answer, message: 'Đánh dấu câu trả lời hữu ích nhất' });
    } catch (error) {
        console.error('Mark best answer error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi đánh dấu câu trả lời' });
    }
};

const toggleLikeAnswer = async (req, res) => {
    try {
        const result = await service.toggleLikeAnswer(req.params.id, req.userId);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Toggle like answer error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi cập nhật lượt thích' });
    }
};

const deleteQuestion = async (req, res) => {
    try {
        await service.deleteQuestion(req.params.id, req.userId);
        res.json({ success: true, message: 'Xóa câu hỏi thành công' });
    } catch (error) {
        console.error('Delete question error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi xóa câu hỏi' });
    }
};

const deleteAnswer = async (req, res) => {
    try {
        await service.deleteAnswer(req.params.id, req.userId);
        res.json({ success: true, message: 'Xóa câu trả lời thành công' });
    } catch (error) {
        console.error('Delete answer error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi xóa câu trả lời' });
    }
};

const report = async (req, res) => {
    try {
        const { type, targetId, reason, description } = req.body;
        console.log(`FAQ report: user=${req.userId} type=${type} target=${targetId} reason=${reason} desc=${description}`);
        res.json({ success: true, message: 'Báo cáo đã được gửi' });
    } catch (error) {
        console.error('FAQ report error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi khi gửi báo cáo' });
    }
};

module.exports = {
    createQuestion,
    getQuestions,
    getPublicMeta,
    getQuestionBySlug,
    incrementViewCount,
    getStatistics,
    toggleLikeQuestion,
    updateQuestion,
    createAnswer,
    markBestAnswer,
    toggleLikeAnswer,
    deleteQuestion,
    deleteAnswer,
    report,
};
