const { Question, Answer, QuestionLike, AnswerLike } = require('./faq.model');
const notificationService = require('../notification/notification.service');
const User = require('../user/user.model');

async function getQuestions({ page = 1, limit = 10, grade = 'all', search = '' }, userId = null) {
    const query = {};
    if (grade !== 'all') query.grade = grade;
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { content: { $regex: search, $options: 'i' } },
        ];
    }

    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
        Question.find(query)
            .populate('userId', 'fullName avatar role')
            .sort({ isPinned: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Question.countDocuments(query),
    ]);

    const questionIds = questions.map(q => q._id);
    const answerCounts = await Answer.aggregate([
        { $match: { questionId: { $in: questionIds } } },
        { $group: { _id: '$questionId', count: { $sum: 1 } } }
    ]);
    const answerCountMap = {};
    answerCounts.forEach(ac => { answerCountMap[ac._id] = ac.count; });

    let userLikedMap = new Map();
    if (userId) {
        const userLikes = await QuestionLike.find({
            questionId: { $in: questionIds },
            userId
        });
        userLikes.forEach(like => {
            userLikedMap.set(like.questionId.toString(), true);
        });
    }

    questions.forEach(q => {
        q.answerCount = answerCountMap[q._id] || 0;
        q.isSolved = !!q.bestAnswerId;
        q.userLiked = userLikedMap.get(q._id.toString()) || false;
    });

    return { questions, total, page, totalPages: Math.ceil(total / limit) };
}

async function getQuestionBySlug(slug, userId = null) {
    const question = await Question.findOne({ slug })
        .populate('userId', 'fullName avatar role')
        .lean();

    if (!question) throw new Error('Không tìm thấy câu hỏi');

    let isLiked = false;
    if (userId) {
        const like = await QuestionLike.findOne({ questionId: question._id, userId });
        isLiked = !!like;
    }

    question.isSolved = !!question.bestAnswerId;

    return { question, isLiked };
}

async function incrementViewCount(slug) {
    const question = await Question.findOneAndUpdate(
        { slug },
        { $inc: { viewCount: 1 } },
        { new: true }
    );

    if (!question) throw new Error('Không tìm thấy câu hỏi');

    return { viewCount: question.viewCount };
}

async function getAnswersByQuestion(questionId, userId = null) {
    const answers = await Answer.find({ questionId })
        .populate('userId', 'fullName avatar role')
        .sort({ isBestAnswer: -1, likeCount: -1, createdAt: 1 })
        .lean();

    let userLikes = new Set();
    if (userId && answers.length > 0) {
        const answerIds = answers.map(a => a._id);
        const likes = await AnswerLike.find({ answerId: { $in: answerIds }, userId });
        userLikes = new Set(likes.map(l => l.answerId.toString()));
    }

    return answers.map(a => ({ ...a, isLiked: userLikes.has(a._id.toString()) }));
}

async function updateAnswer(answerId, userId, content, isAdmin = true) {
    const query = isAdmin ? { _id: answerId } : { _id: answerId, userId };
    const answer = await Answer.findOne(query);

    if (!answer) {
        throw new Error('Không tìm thấy câu trả lời hoặc bạn không có quyền');
    }

    answer.content = content;
    answer.isEdited = true;
    answer.editedAt = new Date();

    await answer.save();

    return answer.populate('userId', 'fullName avatarUrl role');
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
    await AnswerLike.deleteMany({ answerId });

    const remainingAnswers = await Answer.countDocuments({ questionId });
    await Question.findByIdAndUpdate(questionId, {
        $inc: { answerCount: -1 },
        $set: { isSolved: remainingAnswers > 0 ? !!await Answer.findOne({ questionId, isBestAnswer: true }) : false }
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
        QuestionLike.distinct('userId').then(ids => ids.length),
    ]);

    const gradeStats = await Question.aggregate([
        { $group: { _id: '$grade', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);

    const monthlyStats = await Question.aggregate([
        {
            $group: {
                _id: { $month: '$createdAt' },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
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
