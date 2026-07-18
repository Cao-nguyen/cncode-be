const { Question, Answer, QuestionLike, AnswerLike } = require('./faq.model');
const notificationService = require('../notification/notification.service');
const User = require('../user/user.model');

async function createQuestion(userId, data) {
    const question = new Question({
        userId,
        title: data.title,
        content: data.content,
        grade: data.grade || 'other',
        isAnonymous: data.isAnonymous || false,
    });
    await question.save();
    const populatedQuestion = await question.populate('userId', 'fullName avatar role');

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
                    url: `/faq/${populatedQuestion.slug}`
                }
            });
        }
    } catch (error) {
        console.error('Error sending notification to admins:', error);
    }

    return populatedQuestion;
}

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

async function toggleLikeQuestion(questionId, userId) {
    const existing = await QuestionLike.findOne({ questionId, userId });

    if (existing) {
        await existing.deleteOne();
        const question = await Question.findByIdAndUpdate(questionId, { $inc: { likeCount: -1 } }, { new: true });
        return { action: 'removed', likeCount: question.likeCount };
    } else {
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
                        questionId: questionId,
                        questionSlug: question.slug,
                        url: `/faq/${question.slug}`
                    }
                });
            } catch (error) {
                console.error('Error sending notification to question owner:', error);
            }
        }

        return { action: 'added', likeCount: question.likeCount };
    }
}

async function updateQuestion(questionId, userId, data) {
    const question = await Question.findOne({ _id: questionId, userId });
    if (!question) {
        throw new Error('Không tìm thấy câu hỏi hoặc bạn không có quyền');
    }

    if (data.title !== undefined && data.title !== null) {
        question.title = data.title;
    }
    if (data.content !== undefined && data.content !== null) {
        question.content = data.content;
    }

    await question.save();
    return question;
}

async function createAnswer(questionId, userId, content) {
    const question = await Question.findById(questionId).populate('userId', 'fullName');
    if (!question) throw new Error('Không tìm thấy câu hỏi');
    if (question.isLocked) throw new Error('Câu hỏi đã bị khóa, không thể trả lời');

    const answer = new Answer({ questionId, userId, content });
    await answer.save();

    await Question.findByIdAndUpdate(questionId, { $inc: { answerCount: 1 } });

    const populatedAnswer = await answer.populate('userId', 'fullName avatar role');

    if (question.userId._id.toString() !== userId.toString()) {
        try {
            await notificationService.createNotification({
                userId: question.userId._id,
                senderId: userId,
                type: 'faq_new_answer',
                content: `${populatedAnswer.userId.fullName} đã trả lời câu hỏi của bạn: "${question.title}"`,
                meta: {
                    questionId: questionId,
                    answerId: answer._id,
                    questionSlug: question.slug,
                    url: `/faq/${question.slug}`
                }
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
        { new: true }
    ).populate('userId', 'fullName avatar role');

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
    } else {
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
                        answerId: answerId,
                        questionId: answer.questionId._id,
                        questionSlug: answer.questionId.slug,
                        url: `/faq/${answer.questionId.slug}`
                    }
                });
            } catch (error) {
                console.error('Error sending notification to answer owner:', error);
            }
        }

        return { action: 'added', likeCount: answer.likeCount };
    }
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
    await Question.findByIdAndUpdate(questionId, {
        $inc: { answerCount: -1 },
        $set: { isSolved: remainingAnswers > 0 ? !!await Answer.findOne({ questionId, isBestAnswer: true }) : false }
    });

    return true;
}

module.exports = {
    createQuestion,
    getQuestions,
    getQuestionBySlug,
    incrementViewCount,
    getAnswersByQuestion,
    toggleLikeQuestion,
    updateQuestion,
    createAnswer,
    markBestAnswer,
    toggleLikeAnswer,
    deleteQuestion,
    deleteAnswer,
};
