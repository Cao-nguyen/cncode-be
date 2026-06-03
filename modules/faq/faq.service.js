
const { Question, Answer, QuestionLike, AnswerLike } = require('./faq.model');
const notificationService = require('../notification/notification.service');
const User = require('../user/user.model');

class FAQService {

    async createQuestion(userId, data) {
        const question = new Question({
            userId,
            title: data.title,
            content: data.content,
            grade: data.grade || 'other',
            isAnonymous: data.isAnonymous || false,
        });
        await question.save();
        const populatedQuestion = await question.populate('userId', 'fullName avatar role');

        // Thông báo cho admin khi có câu hỏi mới
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

    async getQuestions({ page = 1, limit = 10, grade = 'all', search = '' }, userId = null) {
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

    async getQuestionBySlug(slug, userId = null) {
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

    async incrementViewCount(slug) {
        const question = await Question.findOneAndUpdate(
            { slug },
            { $inc: { viewCount: 1 } },
            { new: true }
        );

        if (!question) throw new Error('Không tìm thấy câu hỏi');

        return { viewCount: question.viewCount };
    }

    async getAnswersByQuestion(questionId, userId = null) {
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

    async toggleLikeQuestion(questionId, userId) {
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

            // Thông báo cho chủ câu hỏi khi có người thả tim (trừ khi tự thả tim cho chính mình)
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

    async updateQuestion(questionId, userId, data) {
        console.log('updateQuestion called:', { questionId, userId, data });

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

    async updateAnswer(answerId, userId, content, isAdmin = false) {
        console.log('updateAnswer called:', { answerId, userId, isAdmin });

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

    async createAnswer(questionId, userId, content) {
        const question = await Question.findById(questionId).populate('userId', 'fullName');
        if (!question) throw new Error('Không tìm thấy câu hỏi');
        if (question.isLocked) throw new Error('Câu hỏi đã bị khóa, không thể trả lời');

        const answer = new Answer({ questionId, userId, content });
        await answer.save();

        await Question.findByIdAndUpdate(questionId, { $inc: { answerCount: 1 } });

        const populatedAnswer = await answer.populate('userId', 'fullName avatar role');

        // Thông báo cho chủ câu hỏi khi có người trả lời (trừ khi tự trả lời câu hỏi của mình)
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

    async markBestAnswer(answerId, questionId, userId) {
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

    async toggleLikeAnswer(answerId, userId) {
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

            // Thông báo cho người trả lời khi có người thả tim (trừ khi tự thả tim cho chính mình)
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

    async togglePinQuestion(questionId) {
        const question = await Question.findById(questionId);
        if (!question) throw new Error('Không tìm thấy câu hỏi');
        question.isPinned = !question.isPinned;
        await question.save();
        return question;
    }

    async toggleLockQuestion(questionId) {
        const question = await Question.findById(questionId);
        if (!question) throw new Error('Không tìm thấy câu hỏi');
        question.isLocked = !question.isLocked;
        await question.save();
        return question;
    }

    async deleteQuestion(questionId, userId, isAdmin = false) {
        const query = isAdmin ? { _id: questionId } : { _id: questionId, userId };
        const question = await Question.findOne(query);
        if (!question) {
            throw new Error('Không tìm thấy câu hỏi hoặc bạn không có quyền xóa');
        }

        await Answer.deleteMany({ questionId });

        await QuestionLike.deleteMany({ questionId });

        await question.deleteOne();
        return true;
    }

    async deleteAnswer(answerId, userId, isAdmin = false) {
        const query = isAdmin ? { _id: answerId } : { _id: answerId, userId };
        const answer = await Answer.findOne(query);
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

    async getStatistics() {
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
}

module.exports = new FAQService();
