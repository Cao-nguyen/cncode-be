const vm = require('vm');
const { PracticeSet, PracticeAttempt } = require('./luyentap.model');
const User = require('../user/user.model');
const Enrollment = require('../enrollment/enrollment.model');
const Course = require('../khoahoc/khoahoc.model');
const { createNotification } = require('../notification/notification.service');

const PASS_THRESHOLD = 80;
const MAX_COIN_REWARD = 50;

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchFilter(search) {
    const trimmed = String(search || '').trim();
    if (!trimmed) return null;
    const pattern = escapeRegex(trimmed);
    return {
        $or: [
            { title: { $regex: pattern, $options: 'i' } },
            { description: { $regex: pattern, $options: 'i' } },
        ],
    };
}

function normalizeShortAnswer(str) {
    return String(str || '').toLowerCase().replace(/[-,\s]/g, '');
}

function sanitizeQuestionForStudent(q) {
    const obj = q.toObject ? q.toObject() : { ...q };
    delete obj.correctAnswer;
    if (obj.options) {
        obj.options = obj.options.map(({ text, _id }) => ({ text, _id }));
    }
    if (obj.trueFalseOptions) {
        obj.trueFalseOptions = obj.trueFalseOptions.map(({ text, _id }) => ({ text, _id }));
    }
    if (obj.testCases) {
        obj.testCases = obj.testCases.map(({ input, _id }) => ({ input, _id }));
    }
    return obj;
}

function sanitizePracticeSet(practice, includeQuestions = true) {
    const obj = practice.toObject ? practice.toObject() : { ...practice };
    if (includeQuestions && obj.questions) {
        obj.questions = obj.questions.map(sanitizeQuestionForStudent);
    } else if (!includeQuestions) {
        delete obj.questions;
    }
    return obj;
}

async function userHasProAccess(userId) {
    if (!userId) return false;
    const user = await User.findById(userId).select('role');
    if (!user) return false;
    if (['admin', 'teacher'].includes(user.role)) return true;

    const enrollments = await Enrollment.find({ userId, paymentStatus: 'completed' }).select('courseId');
    if (!enrollments.length) return false;

    const courseIds = enrollments.map(e => e.courseId);
    const proCourse = await Course.findOne({ _id: { $in: courseIds }, type: 'pro' }).select('_id');
    return !!proCourse;
}

function runJavaScriptCode(code, input) {
    const logs = [];
    const sandbox = {
        input,
        console: {
            log: (...args) => logs.push(args.map(a => String(a)).join(' ')),
        },
        print: (...args) => logs.push(args.map(a => String(a)).join(' ')),
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { timeout: 3000 });
    return logs.join('\n').trim();
}

function runHtmlCssCode(code, language, expectedOutput) {
    const normalized = code.replace(/\s+/g, ' ').trim().toLowerCase();
    const expected = expectedOutput.replace(/\s+/g, ' ').trim().toLowerCase();
    if (language === 'html') {
        return normalized.includes(expected) ? expectedOutput : normalized.slice(0, 200);
    }
    return normalized.includes(expected) ? expectedOutput : normalized.slice(0, 200);
}

function gradeCodeQuestion(question, userCode) {
    const testCases = question.testCases || [];
    if (!testCases.length) return { isCorrect: false, feedback: 'Không có test case' };

    const lang = question.language || 'javascript';
    const results = [];

    for (const tc of testCases) {
        try {
            let output = '';
            if (lang === 'javascript') {
                output = runJavaScriptCode(userCode, tc.input || '');
            } else if (lang === 'html' || lang === 'css') {
                output = runHtmlCssCode(userCode, lang, tc.expectedOutput);
            } else {
                // Python, Pascal, C/C++, C# — so sánh output người dùng gửi kèm hoặc chạy mô phỏng đơn giản
                output = runJavaScriptCode(`
                    function main(input) {
                        ${userCode}
                    }
                    console.log(main(${JSON.stringify(tc.input || '')}));
                `, tc.input || '');
            }
            const match = output.trim() === String(tc.expectedOutput).trim();
            results.push(match);
        } catch (err) {
            results.push(false);
        }
    }

    const isCorrect = results.length > 0 && results.every(Boolean);
    return {
        isCorrect,
        feedback: isCorrect ? 'Tất cả test case đúng' : `${results.filter(Boolean).length}/${results.length} test case đúng`,
    };
}

function gradeQuestion(question, answer) {
    if (answer === undefined || answer === null || answer === '') {
        return { isCorrect: false, pointsEarned: 0, feedback: 'Chưa trả lời' };
    }

    const points = question.points || 1;
    let isCorrect = false;
    let feedback = '';

    switch (question.type) {
        case 'quiz': {
            const idx = typeof answer === 'number' ? answer : parseInt(answer, 10);
            const opt = question.options?.[idx] ||
                question.options?.find(o => o._id?.toString() === String(answer));
            isCorrect = !!opt?.isCorrect;
            feedback = isCorrect ? 'Chính xác' : 'Sai';
            break;
        }
        case 'true-false': {
            const tfOptions = question.trueFalseOptions || [];
            if (!Array.isArray(answer)) {
                isCorrect = false;
                break;
            }
            isCorrect = tfOptions.length > 0
                && answer.length === tfOptions.length
                && answer.every(ua => {
                    const opt = tfOptions.find(o => o._id?.toString() === String(ua.optionId));
                    return opt && opt.isCorrect === ua.answer;
                });
            feedback = isCorrect ? 'Chính xác' : 'Sai';
            break;
        }
        case 'short-answer': {
            const maxLen = question.maxLength || 4;
            const raw = String(answer).trim();
            if (raw.length > maxLen) {
                return { isCorrect: false, pointsEarned: 0, feedback: `Đáp án tối đa ${maxLen} ký tự` };
            }
            if (!/^[0-9,\-]+$/.test(raw)) {
                return { isCorrect: false, pointsEarned: 0, feedback: 'Chỉ được dùng số, dấu phẩy và dấu trừ' };
            }
            isCorrect = normalizeShortAnswer(raw) === normalizeShortAnswer(question.correctAnswer);
            feedback = isCorrect ? 'Chính xác' : 'Sai';
            break;
        }
        case 'essay': {
            const len = String(answer).trim().length;
            isCorrect = len >= 20;
            feedback = isCorrect ? 'Đã nộp bài tự luận' : 'Câu trả lời quá ngắn (tối thiểu 20 ký tự)';
            break;
        }
        case 'code': {
            const result = gradeCodeQuestion(question, String(answer));
            isCorrect = result.isCorrect;
            feedback = result.feedback;
            break;
        }
        default:
            feedback = 'Loại câu hỏi không hỗ trợ';
    }

    return { isCorrect, pointsEarned: isCorrect ? points : 0, feedback };
}

class LuyenTapService {
    async listPublic({ page = 1, limit = 20, tier, search, userId }) {
        const filter = { status: 'approved' };
        if (tier) filter.tier = tier;
        const searchFilter = buildSearchFilter(search);
        if (searchFilter) Object.assign(filter, searchFilter);

        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            PracticeSet.find(filter)
                .select('-questions.correctAnswer -questions.options.isCorrect -questions.trueFalseOptions.isCorrect -questions.testCases.expectedOutput')
                .populate('author', 'fullName avatar username')
                .sort({ publishedAt: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit),
            PracticeSet.countDocuments(filter),
        ]);

        const hasPro = userId ? await userHasProAccess(userId) : false;

        return {
            items: items.map(p => ({
                ...p.toObject(),
                questionCount: p.questions?.length || 0,
                locked: p.tier === 'pro' && !hasPro,
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            hasProAccess: hasPro,
        };
    }

    async getById(id, { userId, forTaking = false } = {}) {
        const practice = await PracticeSet.findById(id).populate('author', 'fullName avatar username');
        if (!practice) return null;

        const isOwner = userId && practice.author._id?.toString() === userId.toString();
        const isAdmin = userId && (await User.findById(userId))?.role === 'admin';

        if (!isOwner && !isAdmin && practice.status !== 'approved') {
            return { error: 'NOT_FOUND' };
        }

        if (practice.tier === 'pro' && userId) {
            const hasPro = await userHasProAccess(userId);
            if (!hasPro && !isOwner && !isAdmin) {
                return { error: 'PRO_REQUIRED' };
            }
        } else if (practice.tier === 'pro' && !userId) {
            return { error: 'LOGIN_REQUIRED' };
        }

        if (forTaking || practice.status === 'approved') {
            return sanitizePracticeSet(practice);
        }

        return practice;
    }

    async getForTaking(id, userId) {
        if (!userId) return { error: 'LOGIN_REQUIRED' };
        return this.getById(id, { userId, forTaking: true });
    }

    async submitAttempt(practiceSetId, userId, answers) {
        const practice = await PracticeSet.findById(practiceSetId);
        if (!practice || practice.status !== 'approved') {
            throw new Error('Bài tập không tồn tại hoặc chưa được duyệt');
        }

        if (practice.tier === 'pro') {
            const hasPro = await userHasProAccess(userId);
            if (!hasPro) throw new Error('Cần tài khoản Pro để làm bài này');
        }

        const questionResults = [];
        let score = 0;
        let totalPoints = 0;

        for (const question of practice.questions) {
            const qId = question._id.toString();
            const userAnswer = answers.find(a => a.questionId === qId);
            const pts = question.points || 1;
            totalPoints += pts;

            const graded = gradeQuestion(question, userAnswer?.answer);
            score += graded.pointsEarned;
            questionResults.push({
                questionId: qId,
                isCorrect: graded.isCorrect,
                pointsEarned: graded.pointsEarned,
                feedback: graded.feedback,
            });
        }

        const percent = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
        const threshold = practice.passThreshold || PASS_THRESHOLD;
        const passed = percent >= threshold;

        let coinsAwarded = 0;
        if (passed) {
            coinsAwarded = Math.floor(Math.random() * MAX_COIN_REWARD);
            await User.findByIdAndUpdate(userId, { $inc: { coins: coinsAwarded } });

            await createNotification({
                userId,
                type: 'system',
                content: `Chúc mừng! Bạn đạt ${percent}% và nhận ${coinsAwarded} xu từ bài luyện tập "${practice.title}"`,
                meta: { practiceSetId, percent, coinsAwarded, link: `/luyentap/${practiceSetId}/kq` },
            }).catch(() => {});
        } else {
            await createNotification({
                userId,
                type: 'system',
                content: `Bạn đạt ${percent}% ở bài "${practice.title}". Cần ${threshold}% để nhận thưởng xu.`,
                meta: { practiceSetId, percent, link: `/luyentap/${practiceSetId}/kq` },
            }).catch(() => {});
        }

        const attempt = await PracticeAttempt.create({
            userId,
            practiceSetId,
            answers,
            score,
            totalPoints,
            percent,
            passed,
            coinsAwarded,
            questionResults,
        });

        await PracticeSet.findByIdAndUpdate(practiceSetId, { $inc: { attemptCount: 1 } });

        return {
            attemptId: attempt._id,
            score,
            totalPoints,
            percent,
            passed,
            coinsAwarded,
            passThreshold: threshold,
            questionResults,
        };
    }

    async getAttempt(attemptId, userId) {
        const attempt = await PracticeAttempt.findById(attemptId)
            .populate('practiceSetId', 'title passThreshold questions');
        if (!attempt) return null;
        if (attempt.userId.toString() !== userId.toString()) return null;

        const practice = attempt.practiceSetId;
        const detailedResults = attempt.questionResults.map(r => {
            const q = practice.questions.find(qs => qs._id.toString() === r.questionId);
            return {
                ...r.toObject?.() || r,
                question: q ? sanitizeQuestionForStudent(q) : null,
                userAnswer: attempt.answers.find(a => a.questionId === r.questionId)?.answer,
            };
        });

        return {
            ...attempt.toObject(),
            practiceTitle: practice.title,
            passThreshold: practice.passThreshold || PASS_THRESHOLD,
            detailedResults,
        };
    }

    async getMyAttempts(practiceSetId, userId) {
        return PracticeAttempt.find({ userId, practiceSetId })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('percent passed coinsAwarded createdAt score totalPoints');
    }

    async listAdmin({ page = 1, limit = 20, status, search }) {
        const filter = {};
        if (status && status !== 'all') filter.status = status;
        const searchFilter = buildSearchFilter(search);
        if (searchFilter) Object.assign(filter, searchFilter);
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            PracticeSet.find(filter)
                .populate('author', 'fullName email username role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            PracticeSet.countDocuments(filter),
        ]);
        return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    async listTeacher(authorId, { page = 1, limit = 20, status }) {
        const filter = { author: authorId };
        if (status && status !== 'all') filter.status = status;
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            PracticeSet.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            PracticeSet.countDocuments(filter),
        ]);
        return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    async create(data, authorId) {
        const practice = await PracticeSet.create({ ...data, author: authorId });
        return practice;
    }

    async update(id, data, userId, isAdmin = false) {
        const practice = await PracticeSet.findById(id);
        if (!practice) throw new Error('Không tìm thấy bài tập');
        if (!isAdmin && practice.author.toString() !== userId.toString()) {
            throw new Error('Không có quyền chỉnh sửa');
        }
        Object.assign(practice, data);
        await practice.save();
        return practice;
    }

    async delete(id, userId, isAdmin = false) {
        const practice = await PracticeSet.findById(id);
        if (!practice) throw new Error('Không tìm thấy bài tập');
        if (!isAdmin && practice.author.toString() !== userId.toString()) {
            throw new Error('Không có quyền xóa');
        }
        await PracticeAttempt.deleteMany({ practiceSetId: id });
        await PracticeSet.findByIdAndDelete(id);
        return true;
    }

    async approve(id, adminId) {
        const practice = await PracticeSet.findByIdAndUpdate(
            id,
            { status: 'approved', rejectionReason: '', publishedAt: new Date() },
            { new: true }
        );
        if (!practice) throw new Error('Không tìm thấy bài tập');

        await createNotification({
            userId: practice.author,
            senderId: adminId,
            type: 'system',
            content: `Bài luyện tập "${practice.title}" đã được duyệt và xuất bản`,
            meta: { practiceSetId: practice._id, link: `/luyentap/${practice._id}` },
        }).catch(() => {});

        return practice;
    }

    async reject(id, adminId, reason) {
        const practice = await PracticeSet.findByIdAndUpdate(
            id,
            { status: 'rejected', rejectionReason: reason || 'Không đạt yêu cầu' },
            { new: true }
        );
        if (!practice) throw new Error('Không tìm thấy bài tập');

        await createNotification({
            userId: practice.author,
            senderId: adminId,
            type: 'system',
            content: `Bài luyện tập "${practice.title}" bị từ chối: ${reason || 'Không đạt yêu cầu'}`,
            meta: { practiceSetId: practice._id, link: '/teacher/luyentap' },
        }).catch(() => {});

        return practice;
    }

    async submitForReview(id, userId) {
        const practice = await PracticeSet.findById(id);
        if (!practice) throw new Error('Không tìm thấy bài tập');
        if (practice.author.toString() !== userId.toString()) throw new Error('Không có quyền');
        if (!practice.questions?.length) throw new Error('Bài tập cần có ít nhất 1 câu hỏi');

        practice.status = 'pending';
        practice.rejectionReason = '';
        await practice.save();
        return practice;
    }

    async runCodeTest({ language, code, input, expectedOutput }) {
        try {
            let output = '';
            if (language === 'javascript') {
                output = runJavaScriptCode(code, input || '');
            } else if (language === 'html' || language === 'css') {
                output = runHtmlCssCode(code, language, expectedOutput);
            } else {
                output = runJavaScriptCode(`
                    function main(input) { ${code} }
                    console.log(main(${JSON.stringify(input || '')}));
                `, input || '');
            }
            const passed = output.trim() === String(expectedOutput).trim();
            return { output, passed };
        } catch (err) {
            return { output: '', passed: false, error: err.message };
        }
    }
}

module.exports = new LuyenTapService();
