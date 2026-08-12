const { Question, Answer, QuestionLike, AnswerLike } = require('./faq.model');
const notificationService = require('../notification/notification.service');
const User = require('../user/user.model');
const { recordUniqueView } = require('../../utils/uniqueView');
const { buildSearchQuery, applyStatusFilter } = require('./faq.constants');

const USER_POPULATE = 'fullName avatar role';

function stripHtml(html = '') {
    return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildQuestionsQuery({ grade = 'all', search = '', status = 'all' } = {}) {
    const query = {};

    if (grade && grade !== 'all') {
        query.grade = grade;
    }

    applyStatusFilter(query, status);

    const searchQuery = buildSearchQuery(search);
    if (searchQuery) {
        if (query.$or && status === 'answered') {
            query.$and = [{ $or: query.$or }, searchQuery];
            delete query.$or;
        } else {
            Object.assign(query, searchQuery);
        }
    }

    return query;
}

async function attachQuestionMeta(questions, userId = null) {
    if (!questions.length) return questions;

    const questionIds = questions.map((q) => q._id);

    const answerCounts = await Answer.aggregate([
        { $match: { questionId: { $in: questionIds } } },
        { $group: { _id: '$questionId', count: { $sum: 1 } } },
    ]);

    const answerCountMap = new Map(answerCounts.map((item) => [item._id.toString(), item.count]));

    let userLikedMap = new Map();
    if (userId) {
        const userLikes = await QuestionLike.find({
            questionId: { $in: questionIds },
            userId,
        });
        userLikes.forEach((like) => {
            userLikedMap.set(like.questionId.toString(), true);
        });
    }

    return questions.map((question) => ({
        ...question,
        answerCount: answerCountMap.get(question._id.toString()) ?? question.answerCount ?? 0,
        isSolved: !!question.bestAnswerId,
        userLiked: userLikedMap.get(question._id.toString()) || false,
    }));
}

async function createQuestion(userId, data) {
    const question = await Question.create({
        userId,
        title: data.title,
        content: data.content,
        grade: data.grade || 'other',
        isAnonymous: data.isAnonymous === true,
    });

    const populatedQuestion = await question.populate('userId', USER_POPULATE);

    try {
        const admins = await User.find({ role: 'admin' }).select('_id');
        for (const admin of admins) {
            await notificationService.createNotification({
                userId: admin._id,
                senderId: userId,
                type: 'faq_new_question',
                content: `${populatedQuestion.userId.fullName} đã đặt câu hỏi: "${data.title}"`,
                meta: {
                    questionId: question._id,
                    questionSlug: populatedQuestion.slug,
                    url: `/faq/${populatedQuestion.slug}`,
                },
            });
        }
    } catch (error) {
        console.error('Error sending notification to admins:', error);
    }

    return populatedQuestion;
}

async function getQuestions({ page = 1, limit = 10, grade = 'all', search = '', status = 'all' } = {}, userId = null) {
    const query = buildQuestionsQuery({ grade, search, status });
    const skip = (page - 1) * limit;

    const [rawQuestions, total] = await Promise.all([
        Question.find(query)
            .populate('userId', USER_POPULATE)
            .sort({ isPinned: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Question.countDocuments(query),
    ]);

    const questions = await attachQuestionMeta(rawQuestions, userId);

    return {
        questions,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
}

async function getPublicQuestionMeta(slug) {
    const question = await Question.findOne({ slug })
        .select('title content slug createdAt updatedAt viewCount answerCount grade isSolved bestAnswerId')
        .lean();

    if (!question) return null;

    return {
        title: question.title,
        description: stripHtml(question.content).slice(0, 160),
        slug: question.slug,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        viewCount: question.viewCount,
        answerCount: question.answerCount,
    };
}

async function getQuestionBySlug(slug, userId = null) {
    const question = await Question.findOne({ slug })
        .populate('userId', USER_POPULATE)
        .lean();

    if (!question) throw new Error('Không tìm thấy câu hỏi');

    let isLiked = false;
    if (userId) {
        const like = await QuestionLike.findOne({ questionId: question._id, userId });
        isLiked = !!like;
    }

    const [enriched] = await attachQuestionMeta([question], userId);

    return { question: enriched, isLiked };
}

async function incrementViewCount(slug, userId = null, guestId = null) {
    const question = await Question.findOne({ slug }).select('_id viewCount');
    if (!question) throw new Error('Không tìm thấy câu hỏi');

    return recordUniqueView({
        targetType: 'faq_question',
        targetId: question._id,
        userId,
        guestId,
        incrementFn: async () => {
            await Question.findByIdAndUpdate(question._id, { $inc: { viewCount: 1 } });
        },
        getViewsFn: async () => {
            const doc = await Question.findById(question._id).select('viewCount').lean();
            return doc?.viewCount || 0;
        },
    });
}

async function getAnswersByQuestion(questionId, userId = null) {
    const answers = await Answer.find({ questionId })
        .populate('userId', USER_POPULATE)
        .sort({ isBestAnswer: -1, likeCount: -1, createdAt: 1 })
        .lean();

    let userLikes = new Set();
    if (userId && answers.length > 0) {
        const answerIds = answers.map((a) => a._id);
        const likes = await AnswerLike.find({ answerId: { $in: answerIds }, userId });
        userLikes = new Set(likes.map((l) => l.answerId.toString()));
    }

    return answers.map((a) => ({ ...a, isLiked: userLikes.has(a._id.toString()) }));
}

async function getPublicStatistics() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalQuestions, answeredQuestions, totalAnswers, totalLikes, todayQuestions] = await Promise.all([
        Question.countDocuments(),
        Question.countDocuments({ answerCount: { $gt: 0 } }),
        Answer.countDocuments(),
        QuestionLike.countDocuments(),
        Question.countDocuments({ createdAt: { $gte: startOfToday } }),
    ]);

    return {
        totalQuestions,
        answeredQuestions,
        pendingQuestions: totalQuestions - answeredQuestions,
        totalAnswers,
        totalLikes,
        todayQuestions,
    };
}

async function toggleLikeQuestion(questionId, userId) {
    const existing = await QuestionLike.findOne({ questionId, userId });

    if (existing) {
        await existing.deleteOne();
        const question = await Question.findByIdAndUpdate(questionId, { $inc: { likeCount: -1 } }, { new: true });
        return { action: 'removed', likeCount: question.likeCount };
    }

    await QuestionLike.create({ questionId, userId });
    const question = await Question.findByIdAndUpdate(questionId, { $inc: { likeCount: 1 } }, { new: true })
        .populate('userId', 'fullName')
        .lean();

    if (question.userId._id.toString() !== userId.toString()) {
        try {
            const liker = await User.findById(userId).select('fullName');
            await notificationService.createNotification({
                userId: question.userId._id,
                senderId: userId,
                type: 'faq_question_liked',
                content: `${liker.fullName} đã thấy câu hỏi của bạn hữu ích: "${question.title}"`,
                meta: {
                    questionId,
                    questionSlug: question.slug,
                    url: `/faq/${question.slug}`,
                },
            });
        } catch (error) {
            console.error('Error sending notification to question owner:', error);
        }
    }

    return { action: 'added', likeCount: question.likeCount };
}

async function updateQuestion(questionId, userId, data) {
    const question = await Question.findOne({ _id: questionId, userId });
    if (!question) {
        throw new Error('Không tìm thấy câu hỏi hoặc bạn không có quyền');
    }

    if (data.title !== undefined) question.title = data.title;
    if (data.content !== undefined) question.content = data.content;

    await question.save();
    return question.populate('userId', USER_POPULATE);
}

async function createAnswer(questionId, userId, content) {
    const question = await Question.findById(questionId).populate('userId', 'fullName');
    if (!question) throw new Error('Không tìm thấy câu hỏi');
    if (question.isLocked) throw new Error('Câu hỏi đã bị khóa, không thể trả lời');

    const answer = await Answer.create({ questionId, userId, content });
    await Question.findByIdAndUpdate(questionId, { $inc: { answerCount: 1 } });

    const populatedAnswer = await answer.populate('userId', USER_POPULATE);

    if (question.userId._id.toString() !== userId.toString()) {
        try {
            await notificationService.createNotification({
                userId: question.userId._id,
                senderId: userId,
                type: 'faq_new_answer',
                content: `${populatedAnswer.userId.fullName} đã trả lời câu hỏi của bạn: "${question.title}"`,
                meta: {
                    questionId,
                    answerId: answer._id,
                    questionSlug: question.slug,
                    url: `/faq/${question.slug}`,
                },
            });
        } catch (error) {
            console.error('Error sending notification to question owner:', error);
        }
    }

    return populatedAnswer;
}

async function markBestAnswer(answerId, questionId, userId) {
    const question = await Question.findOne({ _id: questionId, userId });
    if (!question) throw new Error('Không tìm thấy câu hỏi hoặc bạn không phải chủ câu hỏi');

    await Answer.updateMany({ questionId }, { $set: { isBestAnswer: false } });

    const answer = await Answer.findByIdAndUpdate(
        answerId,
        { isBestAnswer: true },
        { new: true },
    ).populate('userId', USER_POPULATE);

    question.bestAnswerId = answerId;
    question.isSolved = true;
    await question.save();

    return answer;
}

async function toggleLikeAnswer(answerId, userId) {
    const existing = await AnswerLike.findOne({ answerId, userId });

    if (existing) {
        await existing.deleteOne();
        const answer = await Answer.findByIdAndUpdate(answerId, { $inc: { likeCount: -1 } }, { new: true });
        return { action: 'removed', likeCount: answer.likeCount };
    }

    await AnswerLike.create({ answerId, userId });
    const answer = await Answer.findByIdAndUpdate(answerId, { $inc: { likeCount: 1 } }, { new: true })
        .populate('userId', 'fullName')
        .populate('questionId', 'title slug');

    if (answer.userId._id.toString() !== userId.toString()) {
        try {
            const liker = await User.findById(userId).select('fullName');
            await notificationService.createNotification({
                userId: answer.userId._id,
                senderId: userId,
                type: 'faq_answer_liked',
                content: `${liker.fullName} đã thích câu trả lời của bạn trong "${answer.questionId.title}"`,
                meta: {
                    answerId,
                    questionId: answer.questionId._id,
                    questionSlug: answer.questionId.slug,
                    url: `/faq/${answer.questionId.slug}`,
                },
            });
        } catch (error) {
            console.error('Error sending notification to answer owner:', error);
        }
    }

    return { action: 'added', likeCount: answer.likeCount };
}

async function deleteQuestion(questionId, userId) {
    const question = await Question.findOne({ _id: questionId, userId });
    if (!question) {
        throw new Error('Không tìm thấy câu hỏi hoặc bạn không có quyền xóa');
    }

    await Answer.deleteMany({ questionId });
    await QuestionLike.deleteMany({ questionId });
    await question.deleteOne();
    return true;
}

async function deleteAnswer(answerId, userId) {
    const answer = await Answer.findOne({ _id: answerId, userId });
    if (!answer) {
        throw new Error('Không tìm thấy câu trả lời hoặc bạn không có quyền xóa');
    }

    const questionId = answer.questionId;
    await answer.deleteOne();
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

module.exports = {
    createQuestion,
    getQuestions,
    getPublicQuestionMeta,
    getQuestionBySlug,
    incrementViewCount,
    getAnswersByQuestion,
    getPublicStatistics,
    toggleLikeQuestion,
    updateQuestion,
    createAnswer,
    markBestAnswer,
    toggleLikeAnswer,
    deleteQuestion,
    deleteAnswer,
};
