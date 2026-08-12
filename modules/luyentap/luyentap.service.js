const { PracticeExercise, UserExerciseAnswer } = require('./luyentap.model');
const { runAlgorithmCode, gradeWebCode, normalizeOutput } = require('./luyentap.codeRunner');
const slugify = require('slugify');
const mongoose = require('mongoose');

function sanitizeQuestionForTaking(question) {
    const q = question.toObject ? question.toObject() : { ...question };
    delete q.correctAnswer;
    if (q.options) {
        q.options = q.options.map(({ _id, text }) => ({ _id, text }));
    }
    if (q.trueFalseOptions) {
        q.trueFalseOptions = q.trueFalseOptions.map(({ _id, text }) => ({ _id, text }));
    }
    if (q.testCases) {
        q.testCases = q.testCases.map((tc) => {
            if (tc.isSample) {
                return {
                    _id: tc._id,
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                    isSample: true,
                };
            }
            return { _id: tc._id };
        });
    }
    if (q.webRequirements) {
        q.webRequirements = q.webRequirements.map(({ type, selector, tag, property, value, text }) => ({
            type, selector, tag, property, value, text
        }));
    }
    if (q.matchingPairs) {
        delete q.matchingPairs;
    }
    return q;
}

function gradeQuestion(question, answer, trueFalseScale) {
    const points = question.points || 10;
    let isCorrect = false;
    let feedback = '';
    let earnedPoints = 0;

    if (question.type === 'multiple-choice') {
        const selected = question.options?.find(
            (opt) => opt._id.toString() === String(answer.selectedOption)
        );
        isCorrect = !!(selected && selected.isCorrect);
        earnedPoints = isCorrect ? points : 0;
    } else if (question.type === 'multiple-select') {
        const selectedIds = (answer.selectedOptions || []).map(String);
        const correctIds = (question.options || [])
            .filter((opt) => opt.isCorrect)
            .map((opt) => opt._id.toString());
        isCorrect = correctIds.length > 0
            && selectedIds.length === correctIds.length
            && correctIds.every((id) => selectedIds.includes(id));
        earnedPoints = isCorrect ? points : 0;
    } else if (question.type === 'matching') {
        const userPairs = answer.matchingAnswers || [];
        const correctPairs = question.matchingPairs || [];
        isCorrect = correctPairs.length > 0
            && userPairs.length === correctPairs.length
            && correctPairs.every((cp) =>
                userPairs.some((up) => up.leftIndex === cp.leftIndex && up.rightIndex === cp.rightIndex)
            );
        earnedPoints = isCorrect ? points : 0;
    } else if (question.type === 'true-false') {
        const userAnswers = answer.trueFalseAnswers || [];
        const totalOptions = question.trueFalseOptions?.length || 0;
        let correctCount = 0;

        userAnswers.forEach((ua) => {
            const correctOption = question.trueFalseOptions?.[ua.optionIndex];
            if (correctOption && ua.isTrue === correctOption.isCorrect) {
                correctCount += 1;
            }
        });

        isCorrect = correctCount === totalOptions && totalOptions > 0
            && userAnswers.length === totalOptions;

        const scale = trueFalseScale || {};
        const scaleMap = {
            0: 0,
            1: scale.correct1 ?? 10,
            2: scale.correct2 ?? 25,
            3: scale.correct3 ?? 50,
            4: scale.correct4 ?? 100,
        };
        const capped = Math.min(Math.max(correctCount, 0), 4);
        const percent = scaleMap[capped] ?? 0;
        earnedPoints = Math.round((points * percent) / 100 * 100) / 100;
    } else if (question.type === 'short-answer') {
        const userAnswer = answer.shortAnswer?.trim().toLowerCase().replace(/[-,\s]/g, '');
        const correctAnswer = question.correctAnswer?.trim().toLowerCase().replace(/[-,\s]/g, '');
        isCorrect = userAnswer === correctAnswer;
        earnedPoints = isCorrect ? points : 0;
    } else if (question.type === 'essay') {
        const userText = (answer.essayAnswer || '').trim().toLowerCase();
        const sample = (question.sampleAnswer || '').trim().toLowerCase();
        if (!sample) {
            isCorrect = userText.length > 0;
            feedback = 'Câu tự luận cần giáo viên chấm thủ công';
        } else {
            const keywords = sample.split(/\s+/).filter(Boolean);
            const matched = keywords.filter((k) => userText.includes(k)).length;
            isCorrect = keywords.length > 0 ? matched / keywords.length >= 0.5 : userText.length > 0;
        }
        earnedPoints = isCorrect ? points : 0;
    }

    return {
        isCorrect,
        points: earnedPoints ?? (isCorrect ? points : 0),
        feedback
    };
}

async function gradeCodeQuestion(question, answer) {
    const points = question.points || 10;
    const code = answer.codeAnswer || '';

    if (question.codeMode === 'web') {
        const result = gradeWebCode(code, question.webRequirements || []);
        return {
            isCorrect: result.passed,
            points: result.passed ? points : 0,
            feedback: result.passed ? 'Đạt yêu cầu' : 'Chưa đạt yêu cầu đề bài'
        };
    }

    const testCases = question.testCases || [];
    if (testCases.length === 0) {
        const hasCode = code.trim().length > 0;
        return { isCorrect: hasCode, points: hasCode ? points : 0, feedback: '' };
    }

    for (const tc of testCases) {
        const result = await runAlgorithmCode({
            language: question.language || 'python',
            code,
            input: tc.input || '',
            expectedOutput: tc.expectedOutput || ''
        });
        if (!result.passed) {
            return {
                isCorrect: false,
                points: 0,
                feedback: result.error || 'Test case thất bại'
            };
        }
    }

    return { isCorrect: true, points, feedback: 'Tất cả test case đều đúng' };
}

class LuyenTapService {
    async createExercise(data) {
        const slug = slugify(data.title, { lower: true, strict: true });
        const exercise = new PracticeExercise({
            ...data,
            slug,
            createdBy: data.createdBy
        });
        return await exercise.save();
    }

    async updateExercise(id, data) {
        if (data.title) {
            data.slug = slugify(data.title, { lower: true, strict: true });
        }
        return await PracticeExercise.findByIdAndUpdate(id, data, { new: true });
    }

    async deleteExercise(id) {
        await PracticeExercise.findByIdAndDelete(id);
        await UserExerciseAnswer.deleteMany({ exerciseId: id });
    }

    async getAdminExercises(query = {}) {
        const { page = 1, limit = 10, status, search } = query;
        const filter = {};
        if (status) filter.status = status;
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const exercises = await PracticeExercise.find(filter)
            .populate('createdBy', 'fullName name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await PracticeExercise.countDocuments(filter);
        return { exercises, total, page: parseInt(page), limit: parseInt(limit) };
    }

    async getExerciseById(id) {
        return await PracticeExercise.findById(id).populate('createdBy', 'fullName name email');
    }

    async getPublicExercises(query = {}) {
        const { page = 1, limit = 50 } = query;
        const exercises = await PracticeExercise.find({ status: 'published' })
            .select('title slug description thumbnail duration totalPoints participantCount tier difficulty passThreshold questions createdAt')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();

        const mapped = exercises.map((ex) => ({
            ...ex,
            questionCount: ex.questions?.length || 0,
            questions: undefined
        }));

        const total = await PracticeExercise.countDocuments({ status: 'published' });
        return { exercises: mapped, total, page: parseInt(page), limit: parseInt(limit) };
    }

    async getExerciseBySlug(slug) {
        return await PracticeExercise.findOne({ slug, status: 'published' })
            .select('title slug description thumbnail duration totalPoints participantCount tier difficulty passThreshold');
    }

    async getPublicExerciseById(id) {
        const exercise = await PracticeExercise.findOne({ _id: id, status: 'published' })
            .select('title slug description thumbnail duration totalPoints participantCount tier difficulty passThreshold questions createdAt')
            .lean();
        if (!exercise) return null;
        return {
            ...exercise,
            questionCount: exercise.questions?.length || 0,
            questions: exercise.questions?.map((q) => ({
                _id: q._id,
                type: q.type,
                question: q.question
            }))
        };
    }

    async getExerciseForTaking(id) {
        const exercise = await PracticeExercise.findById(id);
        if (!exercise || exercise.status !== 'published') {
            throw new Error('Bài tập không tồn tại hoặc chưa được xuất bản');
        }

        const obj = exercise.toObject();
        obj.questions = obj.questions.map(sanitizeQuestionForTaking);
        return obj;
    }

    async submitAnswer(exerciseId, userId, answers, timeSpent) {
        const exercise = await PracticeExercise.findById(exerciseId);
        if (!exercise) throw new Error('Bài tập không tồn tại');

        if (exercise.maxAttempts > 0) {
            const attemptCount = await UserExerciseAnswer.countDocuments({ exerciseId, userId });
            if (attemptCount >= exercise.maxAttempts) {
                throw new Error(`Bạn đã đạt số lần làm bài tối đa (${exercise.maxAttempts})`);
            }
        }

        let totalScore = 0;
        const processedAnswers = [];

        for (const answer of answers) {
            const question = exercise.questions.id(answer.questionId)
                || exercise.questions.find((q) => q._id.toString() === String(answer.questionId));
            if (!question) continue;

            let result;
            if (question.type === 'code') {
                result = await gradeCodeQuestion(question, answer);
            } else {
                result = gradeQuestion(question, answer, exercise.trueFalseScale);
            }

            totalScore += result.points;
            processedAnswers.push({
                questionId: question._id,
                ...answer,
                isCorrect: result.isCorrect,
                points: result.points,
                feedback: result.feedback
            });
        }

        const passThreshold = exercise.passThreshold || 80;
        const percentage = exercise.totalPoints > 0 ? (totalScore / exercise.totalPoints) * 100 : 0;

        let coinsAwarded = 0;
        if (percentage >= passThreshold) {
            coinsAwarded = Math.floor(Math.random() * 51);
            const User = mongoose.model('User');
            const user = await User.findByIdAndUpdate(userId, { $inc: { coins: coinsAwarded } }, { new: true });
            if (user) {
                try {
                    const CoinTransaction = require('../coin/coin.model');
                    await CoinTransaction.create({
                        userId,
                        type: 'credit',
                        amount: coinsAwarded,
                        reason: `Hoàn thành bài tập "${exercise.title}" với điểm số ${percentage.toFixed(0)}%`,
                        relatedId: exerciseId,
                        relatedType: 'exercise',
                        balanceAfter: user.coins
                    });
                } catch (_) { /* coin model optional */ }
            }
        }

        const userAnswer = new UserExerciseAnswer({
            exerciseId,
            userId,
            answers: processedAnswers,
            totalScore,
            percentage,
            coinsAwarded,
            timeSpent,
            submittedAt: new Date()
        });
        await userAnswer.save();

        const isFirstAttempt = await UserExerciseAnswer.countDocuments({ exerciseId, userId }) === 1;
        if (isFirstAttempt) {
            await PracticeExercise.findByIdAndUpdate(exerciseId, { $inc: { participantCount: 1 } });
        }

        return userAnswer;
    }

    async runCodeTest({ language, code, input, expectedOutput, codeMode, webRequirements }) {
        if (codeMode === 'web') {
            const result = gradeWebCode(code, webRequirements || []);
            return {
                success: true,
                passed: result.passed,
                output: result.passed ? 'Đạt yêu cầu' : 'Chưa đạt yêu cầu',
                results: result.results
            };
        }
        return await runAlgorithmCode({ language, code, input, expectedOutput });
    }

    async getExerciseLeaderboard(exerciseId, limit = 50) {
        const allAnswers = await UserExerciseAnswer.aggregate([
            { $match: { exerciseId: new mongoose.Types.ObjectId(exerciseId) } },
            { $sort: { totalScore: -1, timeSpent: 1 } }
        ]);

        const seenUsers = new Set();
        const bestScores = [];
        for (const answer of allAnswers) {
            if (!seenUsers.has(answer.userId.toString())) {
                seenUsers.add(answer.userId.toString());
                bestScores.push(answer);
                if (bestScores.length >= limit) break;
            }
        }

        const userIds = bestScores.map((s) => s.userId);
        const users = await mongoose.model('User').find({ _id: { $in: userIds } });
        const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

        return bestScores.map((entry, index) => {
            const user = userMap[entry.userId.toString()] || {};
            return {
                rank: index + 1,
                userId: entry.userId,
                userName: user.fullName || user.name || 'Unknown',
                userAvatar: user.avatar || '',
                score: entry.totalScore,
                timeSpent: entry.timeSpent,
                submittedAt: entry.submittedAt
            };
        });
    }

    async getOverallLeaderboard(limit = 50) {
        const leaderboard = await UserExerciseAnswer.aggregate([
            {
                $group: {
                    _id: { userId: '$userId', exerciseId: '$exerciseId' },
                    bestScore: { $max: '$totalScore' },
                    bestTime: { $min: '$timeSpent' }
                }
            },
            {
                $group: {
                    _id: '$_id.userId',
                    totalScore: { $sum: '$bestScore' },
                    totalExercises: { $sum: 1 },
                    totalTimeSpent: { $sum: '$bestTime' }
                }
            },
            { $sort: { totalScore: -1, totalTimeSpent: 1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    userId: '$_id',
                    userName: { $ifNull: ['$user.fullName', '$user.name'] },
                    userAvatar: '$user.avatar',
                    totalScore: 1,
                    totalExercises: 1,
                    totalTimeSpent: 1
                }
            }
        ]);

        return leaderboard.map((entry, index) => ({ rank: index + 1, ...entry }));
    }

    async getUserAnswer(exerciseId, userId, answerId = null) {
        const query = { exerciseId, userId };
        if (answerId) query._id = answerId;

        const userAnswer = await UserExerciseAnswer.findOne(query)
            .sort({ submittedAt: -1 });

        if (!userAnswer) throw new Error('Không tìm thấy kết quả');

        const exercise = await PracticeExercise.findById(exerciseId);
        const detailedAnswers = userAnswer.answers.map((answer) => {
            const question = exercise?.questions.find(
                (q) => q._id.toString() === answer.questionId.toString()
            );
            return {
                ...answer.toObject(),
                question: question ? {
                    type: question.type,
                    question: question.question,
                    explanation: question.explanation,
                    options: question.options,
                    trueFalseOptions: question.trueFalseOptions,
                    correctAnswer: question.correctAnswer,
                    sampleAnswer: question.sampleAnswer,
                    language: question.language,
                    codeMode: question.codeMode
                } : null
            };
        });

        return { ...userAnswer.toObject(), answers: detailedAnswers, exercise };
    }

    async getUserExercises(userId) {
        return await UserExerciseAnswer.find({ userId })
            .populate('exerciseId', 'title slug thumbnail totalPoints')
            .sort({ submittedAt: -1 });
    }

    async getUserExerciseHistory(exerciseId, userId) {
        return await UserExerciseAnswer.find({ exerciseId, userId })
            .select('_id totalScore percentage coinsAwarded timeSpent submittedAt')
            .sort({ submittedAt: -1 })
            .lean();
    }

    async checkUserAttempts(exerciseId, userId) {
        const exercise = await PracticeExercise.findById(exerciseId);
        if (!exercise) throw new Error('Bài tập không tồn tại');

        const attemptCount = await UserExerciseAnswer.countDocuments({ exerciseId, userId });
        return {
            attemptCount,
            maxAttempts: exercise.maxAttempts,
            canAttempt: exercise.maxAttempts === 0 || attemptCount < exercise.maxAttempts,
            remainingAttempts: exercise.maxAttempts === 0
                ? null
                : Math.max(0, exercise.maxAttempts - attemptCount)
        };
    }

    async scanExplanations(content) {
        const Groq = require('groq-sdk');
        if (!process.env.GROQ_API_KEY) {
            throw new Error('Chưa cấu hình GROQ_API_KEY trên server');
        }
        if (!content || !content.trim()) {
            throw new Error('Nội dung đề trống');
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `Bạn là giáo viên chuyên soạn đề thi. Đọc nội dung đề markdown và viết lời giải ngắn cho từng câu CHƯA có dòng {lg: ...}.

Trả về JSON thuần (không markdown bọc ngoài):
{"explanations":[{"questionNumber":1,"explanation":"..."}]}

Quy tắc:
- Chỉ trả về câu chưa có {lg: ...}
- Giải thích ngắn 1-3 câu, tiếng Việt
- Trắc nghiệm/đúng sai: giải thích vì sao đáp án có dấu * đúng
- Trả lời ngắn: nêu đáp án và cách làm
- Tự luận: gợi ý hướng trả lời
- Lập trình: giải thích logic/thuật toán
- Không xuống dòng trong explanation
- Nếu không có câu nào cần giải thích: {"explanations":[]}`,
                },
                { role: 'user', content },
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            max_tokens: 4096,
            response_format: { type: 'json_object' },
        });

        const raw = completion.choices[0]?.message?.content || '{}';
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            throw new Error('AI trả về dữ liệu không hợp lệ');
        }

        const explanations = Array.isArray(parsed.explanations) ? parsed.explanations : [];
        return explanations
            .filter((item) => item && typeof item.questionNumber === 'number' && item.explanation)
            .map((item) => ({
                questionNumber: item.questionNumber,
                explanation: String(item.explanation).replace(/\s+/g, ' ').trim(),
            }));
    }
}

module.exports = new LuyenTapService();
