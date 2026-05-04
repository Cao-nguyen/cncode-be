// modules/faq/faq.service.js
const FAQ = require('./faq.model');
const User = require('../user/user.model');
const Notification = require('../notification/notification.model');
const aiService = require('../../services/ai.service');

function getIo() {
    try {
        const { getIo } = require('../../server');
        const io = getIo?.();
        return io;
    } catch (e) {
        console.error('❌ FAQ getIo error:', e.message);
        return null;
    }
}

class FAQService {
    async createQuestion(userId, data) {
        const { title, content, category, tags = [] } = data;

        if (!title || title.trim().length === 0) {
            throw new Error('Tiêu đề không được để trống');
        }
        if (title.length > 200) {
            throw new Error('Tiêu đề không được quá 200 ký tự');
        }
        if (!content || content.trim().length === 0) {
            throw new Error('Nội dung không được để trống');
        }
        if (content.length > 2000) {
            throw new Error('Nội dung không được quá 2000 ký tự');
        }

        const user = await User.findById(userId).select('fullName username avatar');

        const question = new FAQ({
            userId,
            title: title.trim(),
            content: content.trim(),
            category: category || 'general',
            tags: tags.filter(t => t.trim()).map(t => t.trim()),
            status: 'pending',
            answers: []
        });

        await question.save();
        await question.populate('user');

        // Tạo câu trả lời từ AI Groq
        const aiAnswerContent = await aiService.generateAnswer(content);

        const aiAnswer = {
            userId: null,
            userType: 'ai',
            content: aiAnswerContent,
            isAiGenerated: true,
            aiModel: 'groq-mixtral',
            likes: 0,
            likedBy: [],
            isAccepted: false,
            isBest: false
        };

        question.answers.push(aiAnswer);
        question.status = 'answered';
        await question.save();

        await question.populate('answers.userId', '_id fullName avatar');

        // Gửi thông báo cho admin
        const admins = await User.find({ role: 'admin' }).select('_id');
        const io = getIo();

        if (admins.length > 0) {
            const notificationContent = `❓ Câu hỏi mới từ ${user?.fullName || 'Người dùng'}: "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}"`;

            await Notification.insertMany(
                admins.map(admin => ({
                    userId: admin._id,
                    senderId: userId,
                    type: 'system',
                    content: notificationContent,
                    meta: { questionId: question._id, title, category, isAiAnswered: true },
                    read: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }))
            );

            if (io) {
                admins.forEach(admin => {
                    io.to(admin._id.toString()).emit('new_notification', {
                        type: 'system',
                        content: notificationContent,
                        meta: { questionId: question._id, title }
                    });
                    io.to(admin._id.toString()).emit('faq_new_question', question);
                });
            }
        }

        if (io) {
            io.emit('faq_question_created', question);
        }

        return question;
    }

    async getQuestions(page = 1, limit = 10, category = null, status = null, search = '') {
        const skip = (page - 1) * limit;

        let query = {};
        if (category && category !== 'all') {
            query.category = category;
        }
        if (status && status !== 'all') {
            query.status = status;
        }
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }

        const [questions, total, stats] = await Promise.all([
            FAQ.find(query)
                .populate('user')
                .populate('answers.userId', '_id fullName email avatar username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FAQ.countDocuments(query),
            FAQ.getStats()
        ]);

        const formattedQuestions = questions.map(q => ({
            ...q,
            answerCount: q.answers?.length || 0,
            acceptedAnswer: q.answers?.find(a => a.isAccepted) || null,
            bestAnswer: q.answers?.find(a => a.isBest) || null,
            aiAnswer: q.answers?.find(a => a.isAiGenerated) || null
        }));

        return {
            questions: formattedQuestions,
            stats,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getQuestionById(questionId, userId = null) {
        const question = await FAQ.findById(questionId)
            .populate('user')
            .populate('answers.userId', '_id fullName email avatar username');

        if (!question) {
            throw new Error('Không tìm thấy câu hỏi');
        }

        question.views += 1;
        await question.save();

        return {
            ...question.toObject(),
            answerCount: question.answers?.length || 0,
            acceptedAnswer: question.answers?.find(a => a.isAccepted) || null,
            bestAnswer: question.answers?.find(a => a.isBest) || null,
            aiAnswer: question.answers?.find(a => a.isAiGenerated) || null
        };
    }

    async addAnswer(questionId, userId, content, userType = 'user') {
        if (!content || content.trim().length === 0) {
            throw new Error('Nội dung câu trả lời không được để trống');
        }
        if (content.length > 2000) {
            throw new Error('Nội dung không được quá 2000 ký tự');
        }

        const question = await FAQ.findById(questionId);
        if (!question) {
            throw new Error('Không tìm thấy câu hỏi');
        }

        const user = await User.findById(userId).select('fullName username avatar');

        const newAnswer = {
            userId: userId,
            userType,
            content: content.trim(),
            isAiGenerated: false,
            likes: 0,
            likedBy: []
        };

        question.answers.push(newAnswer);

        if (question.status === 'pending') {
            question.status = 'answered';
        }

        await question.save();

        const populatedQuestion = await FAQ.findById(questionId)
            .populate('user')
            .populate('answers.userId', '_id fullName email avatar username');

        const addedAnswer = populatedQuestion.answers[populatedQuestion.answers.length - 1];

        // Gửi thông báo cho chủ câu hỏi
        if (question.userId.toString() !== userId) {
            const notification = await Notification.create({
                userId: question.userId,
                senderId: userId,
                type: 'system',
                content: `${user?.fullName} đã trả lời câu hỏi "${question.title.substring(0, 50)}${question.title.length > 50 ? '...' : ''}" của bạn`,
                meta: { questionId, answerId: addedAnswer._id },
                read: false
            });

            const io = getIo();
            if (io) {
                io.to(question.userId.toString()).emit('new_notification', notification);
            }
        }

        const io = getIo();
        if (io) {
            io.emit('faq_new_answer', { questionId, answer: addedAnswer, question: populatedQuestion });
        }

        return addedAnswer;
    }

    async markBestAnswer(questionId, answerId, userId, isAdmin = false) {
        const question = await FAQ.findById(questionId);
        if (!question) {
            throw new Error('Không tìm thấy câu hỏi');
        }

        if (!isAdmin && question.userId.toString() !== userId) {
            throw new Error('Bạn không có quyền đánh dấu câu trả lời hay nhất');
        }

        const answer = question.answers.id(answerId);
        if (!answer) {
            throw new Error('Không tìm thấy câu trả lời');
        }

        // Bỏ đánh dấu best của tất cả
        question.answers.forEach(a => {
            a.isBest = false;
        });

        answer.isBest = true;

        if (!answer.isAccepted) {
            answer.isAccepted = true;
            question.status = 'resolved';
            question.resolvedAt = new Date();
            question.resolvedBy = userId;
        }

        await question.save();

        const io = getIo();
        if (io) {
            io.emit('faq_best_answer', { questionId, answerId, question });
        }

        return question;
    }

    async likeAnswer(questionId, answerId, userId) {
        const question = await FAQ.findById(questionId);
        if (!question) {
            throw new Error('Không tìm thấy câu hỏi');
        }

        const answer = question.answers.id(answerId);
        if (!answer) {
            throw new Error('Không tìm thấy câu trả lời');
        }

        const alreadyLiked = answer.likedBy.includes(userId);

        if (alreadyLiked) {
            answer.likes -= 1;
            answer.likedBy = answer.likedBy.filter(id => id.toString() !== userId);
        } else {
            answer.likes += 1;
            answer.likedBy.push(userId);
        }

        await question.save();

        const io = getIo();
        if (io) {
            io.emit('faq_answer_liked', { questionId, answerId, likes: answer.likes, userId });
        }

        return { likes: answer.likes, liked: !alreadyLiked };
    }

    async markHelpful(questionId, isHelpful, userId) {
        const question = await FAQ.findById(questionId);
        if (!question) {
            throw new Error('Không tìm thấy câu hỏi');
        }

        if (isHelpful) {
            question.helpful += 1;
        } else {
            question.notHelpful += 1;
        }

        await question.save();

        const io = getIo();
        if (io) {
            io.emit('faq_helpful_updated', { questionId, helpful: question.helpful, notHelpful: question.notHelpful });
        }

        return { helpful: question.helpful, notHelpful: question.notHelpful };
    }

    async deleteQuestion(questionId, userId, isAdmin = false) {
        const question = await FAQ.findById(questionId);
        if (!question) {
            throw new Error('Không tìm thấy câu hỏi');
        }

        if (!isAdmin && question.userId.toString() !== userId) {
            throw new Error('Bạn không có quyền xóa câu hỏi này');
        }

        await FAQ.findByIdAndDelete(questionId);

        const io = getIo();
        if (io) {
            io.emit('faq_question_deleted', questionId);
        }

        return { success: true };
    }

    async deleteAnswer(questionId, answerId, userId, isAdmin = false) {
        const question = await FAQ.findById(questionId);
        if (!question) {
            throw new Error('Không tìm thấy câu hỏi');
        }

        const answer = question.answers.id(answerId);
        if (!answer) {
            throw new Error('Không tìm thấy câu trả lời');
        }

        if (!isAdmin && answer.userId?.toString() !== userId) {
            throw new Error('Bạn không có quyền xóa câu trả lời này');
        }

        answer.remove();
        await question.save();

        const io = getIo();
        if (io) {
            io.emit('faq_answer_deleted', { questionId, answerId });
        }

        return { success: true };
    }

    async getUserQuestions(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [questions, total] = await Promise.all([
            FAQ.find({ userId })
                .populate('user')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FAQ.countDocuments({ userId })
        ]);

        return {
            questions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getRelatedQuestions(content, limit = 5) {
        const keywords = content.split(' ').slice(0, 10).join(' ');

        const questions = await FAQ.find({
            $or: [
                { title: { $regex: keywords, $options: 'i' } },
                { content: { $regex: keywords, $options: 'i' } }
            ],
            status: { $in: ['answered', 'resolved'] }
        })
            .limit(limit)
            .lean();

        return questions;
    }
}

module.exports = new FAQService();