const { Question, Answer, QuestionLike } = require('./faq.model');
const userService = require('./faq.service.user');

async function getQuestions(params, userId = null) {
    return userService.getQuestions(params, userId);
}

async function getQuestionBySlug(slug, userId = null) {
    return userService.getQuestionBySlug(slug, userId);
}

async function incrementViewCount(slug, userId = null, guestId = null) {
    return userService.incrementViewCount(slug, userId, guestId);
}

async function getAnswersByQuestion(questionId, userId = null) {
    return userService.getAnswersByQuestion(questionId, userId);
}

async function updateAnswer(answerId, userId, content) {
    const answer = await Answer.findById(answerId);
    if (!answer) {
        throw new Error('Không tìm thấy câu trả lời');
    }

    answer.content = content;
    answer.isEdited = true;
    await answer.save();

    return answer.populate('userId', 'fullName avatar role');
}

async function togglePinQuestion(questionId) {
    const question = await Question.findById(questionId);
    if (!question) throw new Error('Không tìm thấy câu hỏi');
    question.isPinned = !question.isPinned;
    await question.save();
    return question;
}

async function toggleLockQuestion(questionId) {
    const question = await Question.findById(questionId);
    if (!question) throw new Error('Không tìm thấy câu hỏi');
    question.isLocked = !question.isLocked;
    await question.save();
    return question;
}

async function deleteQuestion(questionId) {
    const question = await Question.findById(questionId);
    if (!question) {
        throw new Error('Không tìm thấy câu hỏi');
    }

    await Answer.deleteMany({ questionId });
    await QuestionLike.deleteMany({ questionId });
    await question.deleteOne();
    return true;
}

async function deleteAnswer(answerId) {
    const answer = await Answer.findById(answerId);
    if (!answer) {
        throw new Error('Không tìm thấy câu trả lời');
    }

    const questionId = answer.questionId;
    await answer.deleteOne();

    const { AnswerLike } = require('./faq.model');
    await AnswerLike.deleteMany({ answerId });

    const remainingAnswers = await Answer.countDocuments({ questionId });
    const hasBest = await Answer.findOne({ questionId, isBestAnswer: true });
    await Question.findByIdAndUpdate(questionId, {
        $inc: { answerCount: -1 },
        $set: {
            isSolved: !!hasBest,
            ...(hasBest ? { bestAnswerId: hasBest._id } : { bestAnswerId: null }),
        },
    });

    return true;
}

async function getStatistics() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalQuestions, answeredQuestions, totalAnswers, totalLikes, todayQuestions, uniqueUsers] = await Promise.all([
        Question.countDocuments(),
        Question.countDocuments({ answerCount: { $gt: 0 } }),
        Answer.countDocuments(),
        QuestionLike.countDocuments(),
        Question.countDocuments({ createdAt: { $gte: startOfToday } }),
        QuestionLike.distinct('userId').then((ids) => ids.length),
    ]);

    const gradeStats = await Question.aggregate([
        { $group: { _id: '$grade', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    const monthlyStats = await Question.aggregate([
        {
            $group: {
                _id: { $month: '$createdAt' },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return {
        totalQuestions,
        answeredQuestions,
        pendingQuestions: totalQuestions - answeredQuestions,
        totalAnswers,
        totalLikes,
        todayQuestions,
        uniqueUsers,
        gradeStats,
        monthlyStats,
    };
}

module.exports = {
    getQuestions,
    getQuestionBySlug,
    incrementViewCount,
    getAnswersByQuestion,
    updateAnswer,
    togglePinQuestion,
    toggleLockQuestion,
    deleteQuestion,
    deleteAnswer,
    getStatistics,
};
