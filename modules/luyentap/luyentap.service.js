const { PracticeExercise, UserExerciseAnswer } = require('./luyentap.model');
const PracticeFolder = require('./luyentapFolder.model');
const PracticeExercisePurchase = require('./luyentapPurchase.model');
const PracticeExerciseReaction = require('./luyentapReaction.model');
const Notification = require('../notification/notification.model');
const { runAlgorithmCode, gradeWebCode, normalizeOutput } = require('./luyentap.codeRunner');
const User = require('../user/user.model');
const CoinTransaction = require('../coin/coin.model');
const {
    resolveExerciseAvailability,
    isExerciseDeliveryExpired,
    hasExamPassword,
    verifyExamPassword,
    canRevealScore,
    canRevealAnswers,
    sanitizeQuestionForResult,
    sanitizePublicExerciseSettings,
} = require('./luyentap.exerciseRules');
const slugify = require('slugify');
const mongoose = require('mongoose');

function submittedAnswerFilter() {
    return { $or: [{ status: 'submitted' }, { status: { $exists: false } }] };
}

function historyVisibleFilter(now = new Date()) {
    return {
        $or: [
            { status: 'submitted' },
            { status: { $exists: false } },
            { status: 'in_progress' },
        ],
    };
}

function resolveExerciseTotalPoints(exercise) {
    const fromField = Number(exercise?.totalPoints) || 0;
    if (fromField > 0) return fromField;
    if (!Array.isArray(exercise?.questions) || !exercise.questions.length) return 0;
    return exercise.questions.reduce((sum, q) => sum + (Number(q.points) || 10), 0);
}

function resolveEssayMaxPoints(exercise) {
    return (exercise.questions || [])
        .filter((q) => q.type === 'essay')
        .reduce((sum, q) => sum + (Number(q.points) || 10), 0);
}

function computeExercisePassPercentage(totalScore, exercise, options = {}) {
    const score = Number(totalScore);
    if (Number.isNaN(score)) {
        return Number(options.percentage) || 0;
    }

    const totalPoints = resolveExerciseTotalPoints(exercise);
    const essayMaxPoints = options.essayMaxPoints ?? resolveEssayMaxPoints(exercise);
    const essayGradingPending = Boolean(options.essayGradingPending);

    if (essayGradingPending && essayMaxPoints > 0) {
        const gradableTotal = Math.max(1, totalPoints - essayMaxPoints);
        return (score / gradableTotal) * 100;
    }

    if (totalPoints > 0) {
        return (score / totalPoints) * 100;
    }

    return Number(options.percentage) || 0;
}

function resolveSpinPassPercentage(userAnswer, exercise) {
    const computed = computeExercisePassPercentage(userAnswer?.totalScore, exercise, {
        percentage: userAnswer?.percentage,
        essayGradingPending: userAnswer?.essayGradingPending,
    });
    const stored = Number(userAnswer?.percentage) || 0;
    return Math.max(computed, stored);
}

function resolveAttemptTimeSpent(attempt, exercise) {
    const durationMs = (exercise.duration || 30) * 60 * 1000;
    const startedMs = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
    const expiresMs = attempt.expiresAt ? new Date(attempt.expiresAt).getTime() : startedMs + durationMs;
    if (attempt.timeSpent > 0) return attempt.timeSpent;
    return Math.min(
        Math.max(0, Math.floor((expiresMs - startedMs) / 1000)),
        Math.floor(durationMs / 1000),
    );
}

function buildEmptyAnswerPayload(question) {
    const base = { questionId: question._id };
    switch (question.type) {
        case 'multiple-choice':
            return { ...base, selectedOption: undefined };
        case 'multiple-select':
            return { ...base, selectedOptions: [] };
        case 'matching':
            return { ...base, matchingAnswers: [] };
        case 'true-false':
            return { ...base, trueFalseAnswers: [] };
        case 'short-answer':
            return { ...base, shortAnswer: '' };
        case 'essay':
            return { ...base, essayAnswer: '' };
        case 'code':
            return { ...base, codeAnswer: '' };
        default:
            return base;
    }
}

function buildDetailedAnswersForResult(exercise, storedAnswers, revealAnswers) {
    const answerMap = new Map();
    for (const answer of storedAnswers || []) {
        const answerObj = answer?.toObject ? answer.toObject() : { ...answer };
        answerMap.set(String(answerObj.questionId), answerObj);
    }

    return (exercise.questions || []).map((question) => {
        const stored = answerMap.get(question._id.toString());
        const answerObj = stored
            ? { ...stored }
            : {
                ...buildEmptyAnswerPayload(question),
                isCorrect: false,
                points: 0,
                feedback: question.type === 'essay' ? 'Chưa trả lời' : undefined,
                needsManualGrading: false,
            };

        const gradedEssayFeedback = question?.type === 'essay'
            && !answerObj.needsManualGrading
            && answerObj.feedback
            && !['Chờ giáo viên chấm tự luận', 'Chưa trả lời'].includes(answerObj.feedback);

        if (!revealAnswers) {
            delete answerObj.isCorrect;
            if (!gradedEssayFeedback) {
                delete answerObj.feedback;
            }
        }

        return {
            ...answerObj,
            question: sanitizeQuestionForResult(question, revealAnswers),
        };
    });
}

async function gradeAnswersForExercise(exercise, rawAnswers) {
    const answerMap = new Map();
    for (const answer of rawAnswers || []) {
        answerMap.set(String(answer.questionId), answer);
    }

    let totalScore = 0;
    const processedAnswers = [];

    for (const question of exercise.questions || []) {
        const answer = answerMap.get(question._id.toString()) || buildEmptyAnswerPayload(question);

        try {
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
                feedback: result.feedback,
                needsManualGrading: Boolean(result.needsManualGrading),
            });
        } catch {
            processedAnswers.push({
                questionId: question._id,
                ...answer,
                isCorrect: false,
                points: 0,
                feedback: 'Không chấm được (hết giờ)',
                needsManualGrading: false,
            });
        }
    }

    const essayMaxPoints = resolveEssayMaxPoints(exercise);
    const essayGradingPending = processedAnswers.some((entry) => entry.needsManualGrading);

    const percentage = computeExercisePassPercentage(totalScore, exercise, {
        essayGradingPending,
        essayMaxPoints,
    });

    return { totalScore, processedAnswers, percentage, essayGradingPending };
}

function getPayableAmount(exercise) {
    if (!exercise || exercise.tier !== 'pro') return 0;
    return exercise.discountPrice ?? exercise.price ?? 0;
}

async function userOwnsExercise(exerciseId, userId) {
    if (!userId) return false;
    const purchase = await PracticeExercisePurchase.findOne({
        userId,
        exerciseId,
        paymentStatus: 'completed',
    }).lean();
    return !!purchase;
}

function normalizeReactions(reactions) {
    if (!reactions) return {};
    if (reactions instanceof Map) {
        return Object.fromEntries(reactions);
    }
    return { ...reactions };
}

async function bumpExerciseReactionCount(exerciseId, reactionType, delta) {
    if (!delta) return;
    const path = `reactions.${reactionType}`;
    if (delta > 0) {
        await PracticeExercise.updateOne({ _id: exerciseId }, { $inc: { [path]: delta } });
        return;
    }
    await PracticeExercise.updateOne(
        { _id: exerciseId, [path]: { $gt: 0 } },
        { $inc: { [path]: delta } },
    );
}

async function getExerciseReactionCounts(exerciseId) {
    const exercise = await PracticeExercise.findById(exerciseId).select('reactions').lean();
    return normalizeReactions(exercise?.reactions);
}

function resolveExerciseTotalPoints(exercise) {
    const fromField = Number(exercise?.totalPoints) || 0;
    const fromQuestions = Array.isArray(exercise?.questions)
        ? exercise.questions.reduce((sum, question) => sum + (Number(question.points) || 10), 0)
        : 0;
    return Math.max(fromField, fromQuestions, 1);
}

function buildScoreRanges(totalPoints, scores, totalParticipants) {
    const ratios = [0, 0.5, 0.7, 0.8, 1];
    const breakpoints = [...new Set(ratios.map((ratio) => Math.round(totalPoints * ratio)))];
    if (breakpoints[breakpoints.length - 1] !== totalPoints) {
        breakpoints.push(totalPoints);
    }

    const ranges = [];
    for (let index = 0; index < breakpoints.length - 1; index += 1) {
        const min = breakpoints[index];
        const max = breakpoints[index + 1];
        if (min >= max) continue;

        const isLast = index === breakpoints.length - 2;
        const count = scores.filter((value) => (
            isLast ? value >= min && value <= max : value >= min && value < max
        )).length;

        ranges.push({
            label: `${min} - ${max}`,
            min,
            max,
            count,
            percent: totalParticipants > 0 ? Math.round((count / totalParticipants) * 100) : 0,
        });
    }

    if (ranges.length > 0) return ranges;

    return [{
        label: `0 - ${totalPoints}`,
        min: 0,
        max: totalPoints,
        count: scores.filter((value) => value >= 0 && value <= totalPoints).length,
        percent: totalParticipants > 0
            ? Math.round((scores.filter((value) => value >= 0 && value <= totalPoints).length / totalParticipants) * 100)
            : 0,
    }];
}

function buildScoreHistogram(totalPoints, scores) {
    const bucketCount = Math.min(10, Math.max(totalPoints, 5));
    const bucketSize = totalPoints / bucketCount;

    return Array.from({ length: bucketCount }, (_, index) => {
        const min = index === 0 ? 0 : Math.ceil(index * bucketSize);
        const max = index === bucketCount - 1 ? totalPoints : Math.floor((index + 1) * bucketSize);
        const isLast = index === bucketCount - 1;
        const count = scores.filter((value) => (
            isLast ? value >= min && value <= max : value >= min && value < max
        )).length;

        return {
            label: `${min}-${max}`,
            min,
            max,
            count,
        };
    }).filter((bucket, index, all) => {
        if (bucket.min > bucket.max) return false;
        const duplicate = all.findIndex((item) => item.min === bucket.min && item.max === bucket.max);
        return duplicate === index;
    });
}

async function computeAdminBasicStats(exercise) {
    const exerciseId = exercise._id;
    const totalPoints = resolveExerciseTotalPoints(exercise);
    const passThreshold = Number(exercise.passThreshold) || 80;
    const passScore = Math.round(((totalPoints * passThreshold) / 100) * 100) / 100;
    const lowScoreThreshold = totalPoints <= 10
        ? 1
        : Math.max(1, Math.round(totalPoints * 0.1));

    const allAnswers = await UserExerciseAnswer.find({ exerciseId })
        .select('userId status totalScore')
        .lean();

    const registeredUserIds = new Set();
    const submittedUserIds = new Set();
    const inProgressUserIds = new Set();
    let totalAttempts = 0;
    const bestByUser = new Map();

    for (const answer of allAnswers) {
        const uid = String(answer.userId);
        registeredUserIds.add(uid);

        if (answer.status === 'in_progress') {
            inProgressUserIds.add(uid);
            continue;
        }

        submittedUserIds.add(uid);
        totalAttempts += 1;

        const score = Number(answer.totalScore) || 0;
        const current = bestByUser.get(uid);
        if (current == null || score > current) {
            bestByUser.set(uid, score);
        }
    }

    const bestScores = Array.from(bestByUser.values());
    const registeredCount = registeredUserIds.size;
    const completionRate = registeredCount > 0
        ? Math.round((submittedUserIds.size / registeredCount) * 100)
        : 0;

    return {
        registeredCount,
        totalAttempts,
        completionRate,
        inProgressCount: inProgressUserIds.size,
        belowLowScoreCount: bestScores.filter((score) => score < lowScoreThreshold).length,
        passCount: bestScores.filter((score) => score >= passScore).length,
        lowScoreThreshold,
        passScore,
        totalPoints,
        passThreshold,
    };
}

function buildScoreDistributionBuckets(totalPoints, scores, maxBuckets = 10) {
    const pointTotal = Math.max(Math.round(totalPoints), 1);

    if (pointTotal <= maxBuckets) {
        const buckets = [];
        for (let index = 1; index < pointTotal; index += 1) {
            const min = index - 1;
            const max = index;
            buckets.push({
                label: `< ${index}`,
                min,
                max,
                count: scores.filter((score) => score >= min && score < max).length,
            });
        }
        buckets.push({
            label: `≤ ${pointTotal}`,
            min: pointTotal - 1,
            max: pointTotal,
            count: scores.filter((score) => score >= pointTotal - 1 && score <= pointTotal).length,
        });
        return buckets;
    }

    const bucketSize = pointTotal / maxBuckets;
    const buckets = [];
    for (let index = 1; index < maxBuckets; index += 1) {
        const min = (index - 1) * bucketSize;
        const max = index * bucketSize;
        buckets.push({
            label: `< ${Math.round(max)}`,
            min,
            max,
            count: scores.filter((score) => score >= min && score < max).length,
        });
    }
    buckets.push({
        label: `≤ ${pointTotal}`,
        min: (maxBuckets - 1) * bucketSize,
        max: pointTotal,
        count: scores.filter((score) => (
            score >= (maxBuckets - 1) * bucketSize && score <= pointTotal
        )).length,
    });
    return buckets;
}

function buildFrequencyBucketRows(totalPoints, scores, participantCount) {
    const buckets = buildScoreDistributionBuckets(totalPoints, scores);
    return buckets.map((bucket) => ({
        label: bucket.label,
        count: bucket.count,
        percent: participantCount > 0 ? Math.round((bucket.count / participantCount) * 100) : 0,
    }));
}

function isQuestionAttempted(question, answerEntry) {
    if (!answerEntry) return false;

    switch (question.type) {
        case 'multiple-choice':
            return answerEntry.selectedOption != null && answerEntry.selectedOption !== undefined;
        case 'multiple-select':
            return Array.isArray(answerEntry.selectedOptions) && answerEntry.selectedOptions.length > 0;
        case 'matching':
            return Array.isArray(answerEntry.matchingAnswers) && answerEntry.matchingAnswers.length > 0;
        case 'true-false':
            return Array.isArray(answerEntry.trueFalseAnswers) && answerEntry.trueFalseAnswers.length > 0;
        case 'short-answer':
            return Boolean(String(answerEntry.shortAnswer || '').trim());
        case 'essay':
            return Boolean(String(answerEntry.essayAnswer || '').replace(/<[^>]+>/g, '').trim());
        case 'code':
            return Boolean(String(answerEntry.codeAnswer || '').trim());
        default:
            return false;
    }
}

function resolveStudentName(user) {
    if (!user) return 'Người dùng';
    if (typeof user === 'string') return 'Người dùng';
    return user.fullName || user.username || user.name || 'Người dùng';
}

function buildAdminQuestionPreview(question) {
    if (!question) return null;
    const sanitized = sanitizeQuestionForResult(question, true) || {};
    return {
        ...sanitized,
        points: question.points || 10,
        testCases: (question.testCases || []).map((tc) => ({
            input: tc.input || '',
            expectedOutput: tc.expectedOutput || '',
            isSample: Boolean(tc.isSample),
        })),
        webRequirements: (question.webRequirements || []).map((req) => ({
            type: req.type,
            selector: req.selector,
            tag: req.tag,
            property: req.property,
            value: req.value,
            text: req.text,
        })),
    };
}

function normalizeExerciseLookupId(slugOrId) {
    if (slugOrId == null || slugOrId === '') return '';
    if (typeof slugOrId === 'object' && typeof slugOrId.toString === 'function') {
        const text = slugOrId.toString();
        if (mongoose.Types.ObjectId.isValid(text)) return text;
    }
    return String(slugOrId);
}

function isObjectIdString(value) {
    return mongoose.Types.ObjectId.isValid(value)
        && String(new mongoose.Types.ObjectId(value)) === value;
}

function buildPublishedExerciseQuery(slugOrId) {
    const normalized = normalizeExerciseLookupId(slugOrId);
    return isObjectIdString(normalized)
        ? { _id: normalized, status: 'published' }
        : { slug: normalized, status: 'published' };
}

async function findPublishedExercise(slugOrId) {
    return PracticeExercise.findOne(buildPublishedExerciseQuery(slugOrId));
}

function buildExerciseQuery(slugOrId) {
    const normalized = normalizeExerciseLookupId(slugOrId);
    return isObjectIdString(normalized)
        ? { _id: normalized }
        : { slug: normalized };
}

async function findExerciseBySlugOrId(slugOrId) {
    return PracticeExercise.findOne(buildExerciseQuery(slugOrId));
}

function normalizeQuestionsForSave(questions) {
    if (!Array.isArray(questions)) return questions;
    return questions.map((question, index) => {
        const text = String(question?.question || '').trim();
        if (text) return { ...question, question: text };
        return { ...question, question: `Câu ${index + 1}` };
    });
}

async function assertExerciseAccess(exercise, userId) {
    if (!exercise || exercise.tier !== 'pro') return;
    const owned = await userOwnsExercise(exercise._id, userId);
    if (!owned) {
        throw new Error('Bạn cần mua đề này để làm bài');
    }
}

function normalizeFolderId(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '' || value === 'none') return null;
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Thư mục không hợp lệ');
    }
    return value;
}

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
        const hasAnswer = (answer.essayAnswer || '').replace(/<[^>]+>/g, '').trim().length > 0;
        return {
            isCorrect: false,
            points: 0,
            feedback: hasAnswer ? 'Chờ giáo viên chấm tự luận' : 'Chưa trả lời',
            needsManualGrading: hasAnswer,
        };
    }

    return {
        isCorrect,
        points: earnedPoints ?? (isCorrect ? points : 0),
        feedback,
        needsManualGrading: false,
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

function buildAnswersFromDraft(exercise, attempt) {
    const draftAnswers = attempt.draftAnswers && typeof attempt.draftAnswers === 'object'
        ? attempt.draftAnswers
        : {};
    const shuffleState = attempt.shuffleState || {};
    const shuffles = shuffleState.shuffles || {};
    const questionIds = Array.isArray(shuffleState.questionOrder) && shuffleState.questionOrder.length
        ? shuffleState.questionOrder
        : exercise.questions.map((q) => q._id.toString());

    const answers = [];

    for (const questionId of questionIds) {
        const question = exercise.questions.id(questionId)
            || exercise.questions.find((q) => q._id.toString() === String(questionId));
        if (!question) continue;

        const qKey = question._id.toString();
        const rawAnswer = draftAnswers[qKey] ?? draftAnswers[questionId];
        const shuffle = shuffles[qKey] || shuffles[questionId] || {};
        const base = { questionId: question._id };

        if (rawAnswer === undefined || rawAnswer === null) {
            answers.push(buildEmptyAnswerPayload(question));
            continue;
        }

        if (question.type === 'multiple-choice') {
            if (typeof rawAnswer !== 'number') {
                answers.push(buildEmptyAnswerPayload(question));
                continue;
            }
            const originalIdx = Array.isArray(shuffle.options) ? shuffle.options[rawAnswer] : rawAnswer;
            const opt = question.options?.[originalIdx];
            answers.push(opt?._id
                ? { ...base, selectedOption: opt._id }
                : buildEmptyAnswerPayload(question));
        } else if (question.type === 'multiple-select') {
            const indices = Array.isArray(rawAnswer) ? rawAnswer : [];
            const selectedOptions = indices
                .map((idx) => {
                    const originalIdx = Array.isArray(shuffle.options) ? shuffle.options[idx] : idx;
                    return question.options?.[originalIdx]?._id;
                })
                .filter(Boolean);
            answers.push({ ...base, selectedOptions });
        } else if (question.type === 'matching') {
            const userPairs = Array.isArray(rawAnswer) ? rawAnswer : [];
            const matchingAnswers = userPairs.map((pair) => ({
                leftIndex: pair.leftIndex,
                rightIndex: Array.isArray(shuffle.matchingRight)
                    ? (shuffle.matchingRight[pair.rightIndex] ?? pair.rightIndex)
                    : pair.rightIndex,
            }));
            answers.push({ ...base, matchingAnswers });
        } else if (question.type === 'true-false') {
            const raw = Array.isArray(rawAnswer) ? rawAnswer : [];
            const trueFalseAnswers = raw.map((entry) => {
                if (typeof entry.optionIndex === 'number') {
                    return { optionIndex: entry.optionIndex, isTrue: entry.isTrue ?? entry.answer };
                }
                const optionId = entry.optionId;
                const originalIndex = question.trueFalseOptions?.findIndex(
                    (option, index) => String(option._id ?? index) === String(optionId),
                ) ?? -1;
                return { optionIndex: Math.max(0, originalIndex), isTrue: entry.answer };
            }).filter((entry) => entry.optionIndex >= 0);
            answers.push({ ...base, trueFalseAnswers });
        } else if (question.type === 'short-answer') {
            answers.push({ ...base, shortAnswer: String(rawAnswer || '') });
        } else if (question.type === 'essay') {
            answers.push({ ...base, essayAnswer: String(rawAnswer || '') });
        } else if (question.type === 'code') {
            answers.push({ ...base, codeAnswer: String(rawAnswer || '') });
        } else {
            answers.push(buildEmptyAnswerPayload(question));
        }
    }

    return answers;
}

class LuyenTapService {
    async createExercise(data) {
        const payload = { ...data };
        if ('folderId' in payload) {
            payload.folderId = normalizeFolderId(payload.folderId);
            if (payload.folderId) {
                const folder = await PracticeFolder.findById(payload.folderId);
                if (!folder) throw new Error('Thư mục không tồn tại');
            }
        }
        if (Array.isArray(payload.questions)) {
            payload.questions = normalizeQuestionsForSave(payload.questions);
        }
        const slug = slugify(payload.title, { lower: true, strict: true });
        const exercise = new PracticeExercise({
            ...payload,
            slug,
            createdBy: payload.createdBy
        });
        return await exercise.save();
    }

    async updateExercise(id, data) {
        const payload = { ...data };
        if (payload.title) {
            payload.slug = slugify(payload.title, { lower: true, strict: true });
        }
        if ('folderId' in payload) {
            payload.folderId = normalizeFolderId(payload.folderId);
            if (payload.folderId) {
                const folder = await PracticeFolder.findById(payload.folderId);
                if (!folder) throw new Error('Thư mục không tồn tại');
            }
        }
        if (Array.isArray(payload.questions)) {
            payload.questions = normalizeQuestionsForSave(payload.questions);
        }
        return await PracticeExercise.findByIdAndUpdate(id, payload, { new: true })
            .populate('folderId', 'name');
    }

    async deleteExercise(id) {
        const exercise = await PracticeExercise.findById(id);
        if (!exercise) throw new Error('Bài tập không tồn tại');

        const exerciseObjectId = exercise._id;

        await Promise.all([
            UserExerciseAnswer.deleteMany({ exerciseId: exerciseObjectId }),
            PracticeExercisePurchase.deleteMany({ exerciseId: exerciseObjectId }),
            PracticeExerciseReaction.deleteMany({ exerciseId: exerciseObjectId }),
            Notification.deleteMany({ 'meta.exerciseId': exerciseObjectId }),
        ]);

        await PracticeExercise.findByIdAndDelete(exerciseObjectId);
    }

    async getAdminExercises(query = {}) {
        const { page = 1, limit = 10, status, search, folderId } = query;
        const filter = {};
        if (status) filter.status = status;
        if (folderId === 'none') {
            filter.$or = [{ folderId: null }, { folderId: { $exists: false } }];
        } else if (folderId) {
            filter.folderId = folderId;
        }
        if (search) {
            const searchFilter = {
                $or: [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            };
            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, searchFilter];
                delete filter.$or;
            } else {
                Object.assign(filter, searchFilter);
            }
        }

        const exercises = await PracticeExercise.find(filter)
            .populate('createdBy', 'fullName name email')
            .populate('folderId', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await PracticeExercise.countDocuments(filter);
        return { exercises, total, page: parseInt(page), limit: parseInt(limit) };
    }

    async getExerciseById(id) {
        return await PracticeExercise.findById(id)
            .populate('createdBy', 'fullName name email')
            .populate('folderId', 'name');
    }

    async listFolders() {
        const folders = await PracticeFolder.find()
            .sort({ sortOrder: 1, createdAt: -1 })
            .lean();

        const counts = await PracticeExercise.aggregate([
            { $group: { _id: '$folderId', count: { $sum: 1 } } },
        ]);
        const countMap = new Map(
            counts.filter((row) => row._id).map((row) => [String(row._id), row.count]),
        );
        const unassigned = await PracticeExercise.countDocuments({
            $or: [{ folderId: null }, { folderId: { $exists: false } }],
        });
        const totalCount = await PracticeExercise.countDocuments({});

        return {
            folders: folders.map((folder) => ({
                ...folder,
                exerciseCount: countMap.get(String(folder._id)) || 0,
            })),
            unassignedCount: unassigned,
            totalCount,
        };
    }

    async createFolder(data) {
        if (!data.name || !data.name.trim()) {
            throw new Error('Tên thư mục là bắt buộc');
        }
        return PracticeFolder.create({
            name: data.name.trim(),
            description: (data.description || '').trim(),
            sortOrder: Number(data.sortOrder) || 0,
            createdBy: data.createdBy,
        });
    }

    async updateFolder(id, data) {
        const payload = {};
        if (data.name !== undefined) {
            if (!String(data.name).trim()) throw new Error('Tên thư mục là bắt buộc');
            payload.name = String(data.name).trim();
        }
        if (data.description !== undefined) payload.description = String(data.description).trim();
        if (data.sortOrder !== undefined) payload.sortOrder = Number(data.sortOrder) || 0;
        const folder = await PracticeFolder.findByIdAndUpdate(id, payload, { new: true });
        if (!folder) throw new Error('Thư mục không tồn tại');
        return folder;
    }

    async deleteFolder(id) {
        const folder = await PracticeFolder.findById(id);
        if (!folder) throw new Error('Thư mục không tồn tại');
        await PracticeExercise.updateMany({ folderId: id }, { $set: { folderId: null } });
        await PracticeFolder.findByIdAndDelete(id);
        return folder;
    }

    async getPublicExercises(query = {}) {
        const { page = 1, limit = 50 } = query;
        const exercises = await PracticeExercise.find({ status: 'published' })
            .select('title slug description thumbnail duration totalPoints participantCount tier difficulty passThreshold price discountType discountValue discountPrice allowCoinPayment questions createdAt')
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

    async getExerciseBySlug(slugOrId) {
        const normalized = normalizeExerciseLookupId(slugOrId);
        const query = isObjectIdString(normalized)
            ? { _id: normalized, status: 'published' }
            : { slug: normalized, status: 'published' };

        const exercise = await PracticeExercise.findOne(query)
            .select('title slug description thumbnail duration totalPoints participantCount tier difficulty passThreshold price discountType discountValue discountPrice allowCoinPayment questions createdAt grade examPurpose deliveryFrom deliveryTo maxAttempts examPassword proctoring shuffleQuestions shuffleAnswers showScoreWhen showAnswersWhen hideLeaderboard preExamNoticeEnabled preExamNotice')
            .lean();
        if (!exercise) return null;

        const availability = resolveExerciseAvailability(exercise);
        const settings = sanitizePublicExerciseSettings(exercise);

        return {
            ...exercise,
            ...settings,
            availability,
            questionCount: exercise.questions?.length || 0,
            questions: exercise.questions?.map((q) => ({
                _id: q._id,
                type: q.type,
                question: q.question,
            })),
        };
    }

    async getExerciseAccessForUser(exerciseIdOrSlug, userId) {
        const exercise = await findPublishedExercise(exerciseIdOrSlug);
        if (!exercise) throw new Error('Bài tập không tồn tại hoặc chưa được xuất bản');

        const availability = resolveExerciseAvailability(exercise);
        const attemptInfo = userId
            ? await this.checkUserAttempts(normalizeExerciseLookupId(exercise._id), userId)
            : {
                attemptCount: 0,
                maxAttempts: exercise.maxAttempts || 0,
                canAttempt: true,
                remainingAttempts: exercise.maxAttempts > 0 ? exercise.maxAttempts : null,
            };

        return {
            availability,
            hasExamPassword: hasExamPassword(exercise),
            hideLeaderboard: Boolean(exercise.hideLeaderboard),
            preExamNoticeEnabled: Boolean(exercise.preExamNoticeEnabled),
            preExamNotice: exercise.preExamNoticeEnabled ? (exercise.preExamNotice || '') : '',
            ...attemptInfo,
        };
    }

    async verifyExercisePassword(exerciseIdOrSlug, password) {
        const exercise = await findPublishedExercise(exerciseIdOrSlug);
        if (!exercise) throw new Error('Bài tập không tồn tại hoặc chưa được xuất bản');
        if (!hasExamPassword(exercise)) return { verified: true };
        if (!verifyExamPassword(exercise, password)) {
            throw new Error('Mật khẩu phòng thi không đúng');
        }
        return { verified: true };
    }

    async notifyExerciseScoresAfterExpiry(exerciseId) {
        const exercise = await PracticeExercise.findById(exerciseId);
        if (!exercise) return { notified: 0 };
        if ((exercise.showScoreWhen || 'after-submit') !== 'after-expiry') return { notified: 0 };
        if (!isExerciseDeliveryExpired(exercise)) return { notified: 0 };

        const { createNotification } = require('../notification/notification.service');
        const pending = await UserExerciseAnswer.find({
            exerciseId: exercise._id,
            scoreNotified: { $ne: true },
            ...submittedAnswerFilter(),
        }).select('_id userId totalScore percentage').lean();

        let notified = 0;
        for (const answer of pending) {
            try {
                await createNotification({
                    userId: answer.userId,
                    type: 'exercise_score_released',
                    content: `Điểm đề "${exercise.title}" đã được công bố: ${Number(answer.totalScore) || 0}/${exercise.totalPoints || 0} điểm`,
                    postSlug: exercise.slug,
                    postTitle: exercise.title,
                    meta: {
                        exerciseId: exercise._id,
                        answerId: answer._id,
                        totalScore: answer.totalScore,
                        percentage: answer.percentage,
                    },
                });
                await UserExerciseAnswer.updateOne({ _id: answer._id }, { $set: { scoreNotified: true } });
                notified += 1;
            } catch (err) {
                console.error('[Luyentap] score notification failed:', err.message);
            }
        }
        return { notified };
    }

    async getPublicExerciseById(id) {
        const exercise = await PracticeExercise.findOne({ _id: id, status: 'published' })
            .select('title slug description thumbnail duration totalPoints participantCount tier difficulty passThreshold price discountType discountValue discountPrice allowCoinPayment questions createdAt')
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

    async getExerciseForTaking(id, userId) {
        const exercise = await findPublishedExercise(id);
        if (!exercise) {
            throw new Error('Bài tập không tồn tại hoặc chưa được xuất bản');
        }

        await assertExerciseAccess(exercise, userId);

        const availability = resolveExerciseAvailability(exercise);
        if (!availability.canEnter) {
            throw new Error(availability.message || 'Không thể làm bài lúc này');
        }

        const obj = exercise.toObject();
        obj.questions = obj.questions.map(sanitizeQuestionForTaking);
        obj.hasExamPassword = hasExamPassword(exercise);
        delete obj.examPassword;
        return obj;
    }

    async startOrResumeAttempt(exerciseIdOrSlug, userId, options = {}) {
        const exercise = await findPublishedExercise(exerciseIdOrSlug);
        if (!exercise) {
            throw new Error('Bài tập không tồn tại hoặc chưa được xuất bản');
        }

        await assertExerciseAccess(exercise, userId);

        const availability = resolveExerciseAvailability(exercise);
        if (!availability.canEnter) {
            throw new Error(availability.message || 'Không thể làm bài lúc này');
        }

        if (hasExamPassword(exercise) && !verifyExamPassword(exercise, options.examPassword)) {
            throw new Error('Mật khẩu phòng thi không đúng');
        }

        const now = new Date();
        const expiredAttempts = await UserExerciseAnswer.find({
            exerciseId: exercise._id,
            userId,
            status: 'in_progress',
            expiresAt: { $lte: now },
        });

        for (const attempt of expiredAttempts) {
            await this.autoSubmitExpiredAttempt(exercise, attempt);
        }

        let attempt = await UserExerciseAnswer.findOne({
            exerciseId: exercise._id,
            userId,
            status: 'in_progress',
            expiresAt: { $gt: now },
        });

        if (!attempt) {
            if (exercise.maxAttempts > 0) {
                const submittedCount = await UserExerciseAnswer.countDocuments({
                    exerciseId: exercise._id,
                    userId,
                    ...submittedAnswerFilter(),
                });
                if (submittedCount >= exercise.maxAttempts) {
                    throw new Error('Đã hết lượt');
                }
            }

            if (exercise.preExamNoticeEnabled && !options.acknowledgePreExam) {
                throw new Error('PRE_EXAM_ACK_REQUIRED');
            }

            const durationMs = (exercise.duration || 30) * 60 * 1000;
            attempt = new UserExerciseAnswer({
                exerciseId: exercise._id,
                userId,
                status: 'in_progress',
                startedAt: now,
                expiresAt: new Date(now.getTime() + durationMs),
                submittedAt: now,
                draftAnswers: {},
                answers: [],
                activeIndex: 0,
                timeSpent: 0,
                totalScore: 0,
                percentage: 0,
                coinsAwarded: 0,
            });
            await attempt.save();
        }

        return attempt.toObject();
    }

    async autoSubmitExpiredAttempt(exercise, attempt) {
        const timeSpent = resolveAttemptTimeSpent(attempt, exercise);

        try {
            const answers = buildAnswersFromDraft(exercise, attempt);
            await this.submitAnswer(
                exercise._id,
                attempt.userId,
                answers,
                timeSpent,
                attempt._id.toString(),
            );
        } catch {
            await this.finalizeExpiredAttemptRecord(exercise, attempt._id, timeSpent);
        }
    }

    async finalizeExpiredAttemptRecord(exercise, attemptId, timeSpent) {
        const attempt = await UserExerciseAnswer.findOne({
            _id: attemptId,
            exerciseId: exercise._id,
            status: 'in_progress',
        });
        if (!attempt) return null;

        const rawAnswers = buildAnswersFromDraft(exercise, attempt);
        const {
            totalScore,
            processedAnswers,
            percentage,
            essayGradingPending,
        } = await gradeAnswersForExercise(exercise, rawAnswers);

        attempt.status = 'submitted';
        attempt.answers = processedAnswers;
        attempt.totalScore = totalScore;
        attempt.percentage = percentage;
        attempt.essayGradingPending = essayGradingPending;
        attempt.coinsAwarded = 0;
        attempt.timeSpent = timeSpent;
        attempt.submittedAt = attempt.expiresAt || new Date();
        attempt.draftAnswers = null;
        attempt.shuffleState = undefined;
        await attempt.save();

        const submittedCount = await UserExerciseAnswer.countDocuments({
            exerciseId: exercise._id,
            userId: attempt.userId,
            ...submittedAnswerFilter(),
        });
        if (submittedCount === 1) {
            await PracticeExercise.findByIdAndUpdate(exercise._id, { $inc: { participantCount: 1 } });
        }

        return attempt;
    }

    async saveAttemptProgress(exerciseIdOrSlug, userId, attemptId, payload = {}) {
        const exercise = await findPublishedExercise(exerciseIdOrSlug);
        if (!exercise) {
            throw new Error('Bài tập không tồn tại hoặc chưa được xuất bản');
        }

        const attempt = await UserExerciseAnswer.findOne({
            _id: attemptId,
            exerciseId: exercise._id,
            userId,
            status: 'in_progress',
            expiresAt: { $gt: new Date() },
        });

        if (!attempt) {
            throw new Error('Phiên làm bài không tồn tại hoặc đã hết hạn');
        }

        if (payload.draftAnswers !== undefined) {
            attempt.draftAnswers = payload.draftAnswers;
        }
        if (payload.activeIndex !== undefined) {
            attempt.activeIndex = payload.activeIndex;
        }
        if (payload.shuffleState !== undefined) {
            attempt.shuffleState = payload.shuffleState;
        }
        if (payload.timeSpent !== undefined) {
            attempt.timeSpent = Math.max(0, Number(payload.timeSpent) || 0);
        }
        if (payload.tabSwitchCount !== undefined) {
            attempt.tabSwitchCount = Math.max(
                attempt.tabSwitchCount || 0,
                Math.max(0, Number(payload.tabSwitchCount) || 0),
            );
        }

        await attempt.save();
        return attempt.toObject();
    }

    async submitAnswer(exerciseId, userId, answers, timeSpent, attemptId = null) {
        const exercise = await findPublishedExercise(exerciseId);
        if (!exercise) throw new Error('Bài tập không tồn tại');

        await assertExerciseAccess(exercise, userId);

        let existingAttempt = null;
        if (attemptId) {
            existingAttempt = await UserExerciseAnswer.findOne({
                _id: attemptId,
                exerciseId: exercise._id,
                userId,
                status: 'in_progress',
            });
            if (!existingAttempt) {
                const alreadySubmitted = await UserExerciseAnswer.findOne({
                    _id: attemptId,
                    exerciseId: exercise._id,
                    userId,
                    ...submittedAnswerFilter(),
                });
                if (alreadySubmitted) return alreadySubmitted;
            }
        }

        if (exercise.maxAttempts > 0 && !existingAttempt) {
            const attemptCount = await UserExerciseAnswer.countDocuments({
                exerciseId: exercise._id,
                userId,
                ...submittedAnswerFilter(),
            });
            if (attemptCount >= exercise.maxAttempts) {
                throw new Error('Đã hết lượt');
            }
        }

        const {
            totalScore,
            processedAnswers,
            percentage,
            essayGradingPending,
        } = await gradeAnswersForExercise(exercise, answers);

        let coinsAwarded = 0;

        if (attemptId && existingAttempt) {
            existingAttempt.status = 'submitted';
            existingAttempt.answers = processedAnswers;
            existingAttempt.totalScore = totalScore;
            existingAttempt.percentage = percentage;
            existingAttempt.essayGradingPending = essayGradingPending;
            existingAttempt.coinsAwarded = coinsAwarded;
            existingAttempt.timeSpent = timeSpent;
            existingAttempt.submittedAt = new Date();
            existingAttempt.draftAnswers = null;
            existingAttempt.shuffleState = undefined;
            await existingAttempt.save();

            const submittedCount = await UserExerciseAnswer.countDocuments({
                exerciseId: exercise._id,
                userId,
                ...submittedAnswerFilter(),
            });
            if (submittedCount === 1) {
                await PracticeExercise.findByIdAndUpdate(exercise._id, { $inc: { participantCount: 1 } });
            }

            return existingAttempt;
        }

        const userAnswer = new UserExerciseAnswer({
            exerciseId: exercise._id,
            userId,
            answers: processedAnswers,
            totalScore,
            percentage,
            essayGradingPending,
            coinsAwarded,
            timeSpent,
            submittedAt: new Date(),
            status: 'submitted',
        });
        await userAnswer.save();

        const submittedCount = await UserExerciseAnswer.countDocuments({
            exerciseId: exercise._id,
            userId,
            ...submittedAnswerFilter(),
        });
        if (submittedCount === 1) {
            await PracticeExercise.findByIdAndUpdate(exercise._id, { $inc: { participantCount: 1 } });
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
        const exercise = await PracticeExercise.findById(exerciseId).select('hideLeaderboard').lean();
        if (!exercise) throw new Error('Bài tập không tồn tại');
        if (exercise.hideLeaderboard) {
            return [];
        }

        const allAnswers = await UserExerciseAnswer.aggregate([
            {
                $match: {
                    exerciseId: new mongoose.Types.ObjectId(exerciseId),
                    $or: [{ status: 'submitted' }, { status: { $exists: false } }],
                },
            },
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
                percentage: entry.percentage || 0,
                timeSpent: entry.timeSpent,
                submittedAt: entry.submittedAt,
                province: user.province || '',
                school: user.school || '',
            };
        });
    }

    async getOverallLeaderboard(limit = 50) {
        const leaderboard = await UserExerciseAnswer.aggregate([
            {
                $match: {
                    $or: [{ status: 'submitted' }, { status: { $exists: false } }],
                },
            },
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
        const exercise = await findExerciseBySlugOrId(exerciseId);
        if (!exercise) throw new Error('Bài tập không tồn tại');

        if (isExerciseDeliveryExpired(exercise) && (exercise.showScoreWhen || 'after-submit') === 'after-expiry') {
            void this.notifyExerciseScoresAfterExpiry(exercise._id);
        }

        const query = { exerciseId: exercise._id, userId };
        if (answerId) query._id = answerId;

        const userAnswer = await UserExerciseAnswer.findOne(query)
            .sort({ submittedAt: -1 });

        if (!userAnswer) throw new Error('Không tìm thấy kết quả');

        const hasSubmitted = userAnswer.status === 'submitted' || !userAnswer.status;
        const now = new Date();
        const revealScore = canRevealScore(exercise, now, hasSubmitted);
        const revealAnswers = canRevealAnswers(exercise, now, hasSubmitted);

        const detailedAnswers = buildDetailedAnswersForResult(
            exercise,
            userAnswer.answers,
            revealAnswers,
        );

        const result = {
            ...userAnswer.toObject(),
            answers: detailedAnswers,
            overallFeedback: userAnswer.overallFeedback || '',
            exercise: {
                _id: exercise._id,
                title: exercise.title,
                slug: exercise.slug,
                totalPoints: exercise.totalPoints,
                passThreshold: exercise.passThreshold,
                showScoreWhen: exercise.showScoreWhen,
                showAnswersWhen: exercise.showAnswersWhen,
                deliveryTo: exercise.deliveryTo,
                questionCount: exercise.questions?.length || 0,
                questions: revealAnswers
                    ? (exercise.questions || []).map((q) => sanitizeQuestionForResult(q, true))
                    : undefined,
            },
            canViewScore: revealScore,
            canViewAnswers: revealAnswers,
        };

        if (!revealScore) {
            result.totalScore = undefined;
            result.percentage = undefined;
        }

        return result;
    }

    async spinExerciseCoin(exerciseId, userId, answerId) {
        if (!answerId || !mongoose.Types.ObjectId.isValid(answerId)) {
            throw new Error('answerId không hợp lệ');
        }

        const exercise = await findExerciseBySlugOrId(exerciseId);
        if (!exercise) throw new Error('Bài tập không tồn tại');

        let userAnswer = await UserExerciseAnswer.findOne({
            _id: answerId,
            exerciseId: exercise._id,
            userId,
            ...submittedAnswerFilter(),
        });

        if (!userAnswer) {
            const inProgressAttempt = await UserExerciseAnswer.findOne({
                _id: answerId,
                exerciseId: exercise._id,
                userId,
                status: 'in_progress',
            });
            if (inProgressAttempt) {
                const now = new Date();
                if (!inProgressAttempt.expiresAt || inProgressAttempt.expiresAt <= now) {
                    await this.autoSubmitExpiredAttempt(exercise, inProgressAttempt);
                }
                userAnswer = await UserExerciseAnswer.findOne({
                    _id: answerId,
                    exerciseId: exercise._id,
                    userId,
                    ...submittedAnswerFilter(),
                });
            }
        }

        if (!userAnswer) throw new Error('Không tìm thấy kết quả bài làm');

        const passThreshold = exercise.passThreshold || 80;
        const effectivePercentage = resolveSpinPassPercentage(userAnswer, exercise);
        if (effectivePercentage < passThreshold) {
            throw new Error('Chỉ được quay xu khi đạt yêu cầu');
        }

        if (userAnswer.coinSpinClaimed || userAnswer.coinsAwarded > 0) {
            throw new Error('Bạn đã quay xu cho lần làm bài này');
        }

        const coinsAwarded = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50][
            Math.floor(Math.random() * 11)
        ];
        const updatedUser = coinsAwarded > 0
            ? await User.findByIdAndUpdate(
                userId,
                { $inc: { coins: coinsAwarded } },
                { new: true },
            )
            : await User.findById(userId);

        if (!updatedUser) throw new Error('Người dùng không tồn tại');

        const balanceAfter = Number(updatedUser.coins) || 0;

        await CoinTransaction.create({
            userId,
            type: 'credit',
            amount: coinsAwarded,
            reason: coinsAwarded > 0
                ? `Quay xu may mắn — hoàn thành "${exercise.title}" (${effectivePercentage.toFixed(0)}%)`
                : `Quay xu may mắn — "${exercise.title}" (Chúc bạn may mắn lần sau)`,
            relatedId: userAnswer._id,
            relatedType: 'exercise_spin',
            balanceAfter,
        });

        userAnswer.coinsAwarded = coinsAwarded;
        userAnswer.coinSpinClaimed = true;
        await userAnswer.save();

        return {
            coinsAwarded,
            coinSpinClaimed: true,
            balanceAfter,
            message: coinsAwarded > 0
                ? `Chúc mừng! Bạn nhận được ${coinsAwarded} xu`
                : 'Chúc bạn may mắn lần sau',
        };
    }

    async getUserExercises(userId) {
        return await UserExerciseAnswer.find({ userId, ...submittedAnswerFilter() })
            .populate('exerciseId', 'title slug thumbnail totalPoints')
            .sort({ submittedAt: -1 });
    }

    async getUserExerciseHistory(exerciseId, userId) {
        const now = new Date();
        const exercise = await PracticeExercise.findById(exerciseId);
        if (exercise) {
            if (isExerciseDeliveryExpired(exercise)) {
                void this.notifyExerciseScoresAfterExpiry(exercise._id);
            }
            const expiredAttempts = await UserExerciseAnswer.find({
                exerciseId,
                userId,
                status: 'in_progress',
                expiresAt: { $lte: now },
            });
            for (const attempt of expiredAttempts) {
                await this.autoSubmitExpiredAttempt(exercise, attempt);
            }
        }

        return await UserExerciseAnswer.find({
            exerciseId,
            userId,
            ...historyVisibleFilter(now),
        })
            .select('_id totalScore percentage coinsAwarded timeSpent submittedAt startedAt expiresAt status activeIndex tabSwitchCount')
            .sort({ submittedAt: -1 })
            .lean();
    }

    async checkUserAttempts(exerciseId, userId) {
        const exercise = await findExerciseBySlugOrId(exerciseId);
        if (!exercise) throw new Error('Bài tập không tồn tại');

        const attemptCount = await UserExerciseAnswer.countDocuments({
            exerciseId: exercise._id,
            userId,
            ...submittedAnswerFilter(),
        });
        return {
            attemptCount,
            maxAttempts: exercise.maxAttempts,
            canAttempt: exercise.maxAttempts === 0 || attemptCount < exercise.maxAttempts,
            remainingAttempts: exercise.maxAttempts === 0
                ? null
                : Math.max(0, exercise.maxAttempts - attemptCount)
        };
    }

    async getUserPurchasedExerciseIds(userId) {
        const purchases = await PracticeExercisePurchase.find({
            userId,
            paymentStatus: 'completed',
        }).select('exerciseId').lean();
        return purchases.map((p) => String(p.exerciseId));
    }

    async getPurchaseStatus(exerciseId, userId) {
        const exercise = await findPublishedExercise(exerciseId);
        if (!exercise) throw new Error('Bài tập không tồn tại');

        const resolvedExerciseId = normalizeExerciseLookupId(exercise._id);
        const amount = getPayableAmount(exercise);
        const completed = await PracticeExercisePurchase.findOne({
            userId,
            exerciseId: resolvedExerciseId,
            paymentStatus: 'completed',
        }).sort({ updatedAt: -1 });

        if (completed) {
            return {
                owned: true,
                paymentStatus: 'completed',
                purchase: completed,
                amount,
            };
        }

        const pending = await PracticeExercisePurchase.findOne({
            userId,
            exerciseId: resolvedExerciseId,
            paymentStatus: 'pending',
        }).sort({ updatedAt: -1 });

        return {
            owned: false,
            paymentStatus: pending?.paymentStatus || 'none',
            purchase: pending || null,
            amount,
            allowCoinPayment: !!exercise.allowCoinPayment,
        };
    }

    async purchaseWithCoin(exerciseId, userId) {
        const User = mongoose.model('User');
        const [exercise, user] = await Promise.all([
            PracticeExercise.findOne({ _id: exerciseId, status: 'published' }),
            User.findById(userId),
        ]);

        if (!exercise) throw new Error('Bài tập không tồn tại');
        if (!user) throw new Error('Người dùng không tồn tại');

        const existingCompleted = await PracticeExercisePurchase.findOne({
            userId,
            exerciseId,
            paymentStatus: 'completed',
        });
        if (existingCompleted) {
            return { purchase: existingCompleted, alreadyOwned: true };
        }

        const amount = getPayableAmount(exercise);
        if (amount <= 0) {
            const purchase = await PracticeExercisePurchase.findOneAndUpdate(
                { userId, exerciseId },
                {
                    $set: {
                        userId,
                        exerciseId,
                        paymentMethod: 'free',
                        paymentStatus: 'completed',
                        amount: 0,
                        purchasedAt: new Date(),
                    },
                    $unset: { orderCode: '' },
                },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            return { purchase, alreadyOwned: false };
        }

        if (!exercise.allowCoinPayment) {
            throw new Error('Đề này không hỗ trợ thanh toán bằng xu');
        }

        if (user.coins < amount) {
            throw new Error(`Không đủ xu. Cần ${amount.toLocaleString('vi-VN')} xu, hiện có ${user.coins.toLocaleString('vi-VN')} xu`);
        }

        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, coins: { $gte: amount } },
            { $inc: { coins: -amount } },
            { new: true }
        );
        if (!updatedUser) {
            throw new Error(`Không đủ xu. Cần ${amount.toLocaleString('vi-VN')} xu`);
        }

        const CoinTransaction = require('../coin/coin.model');
        await CoinTransaction.create({
            userId,
            type: 'debit',
            amount,
            reason: `Mua đề luyện tập "${exercise.title}"`,
            relatedId: exerciseId,
            relatedType: 'luyentap',
            balanceAfter: updatedUser.coins,
        });

        const purchase = await PracticeExercisePurchase.findOneAndUpdate(
            { userId, exerciseId },
            {
                $set: {
                    userId,
                    exerciseId,
                    paymentMethod: 'coin',
                    paymentStatus: 'completed',
                    amount,
                    purchasedAt: new Date(),
                },
                $unset: { orderCode: '' },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return { purchase, alreadyOwned: false, coins: updatedUser.coins };
    }

    async createPayOSPurchase(exerciseId, userId) {
        const { PayOS } = require('@payos/node');
        const payos = new PayOS({
            clientId: process.env.PAYOS_CLIENT_ID,
            apiKey: process.env.PAYOS_API_KEY,
            checksumKey: process.env.PAYOS_CHECKSUM_KEY,
        });

        const exercise = await PracticeExercise.findOne({ _id: exerciseId, status: 'published' });
        if (!exercise) throw new Error('Bài tập không tồn tại');

        const existingCompleted = await PracticeExercisePurchase.findOne({
            userId,
            exerciseId,
            paymentStatus: 'completed',
        });
        if (existingCompleted) {
            return { purchase: existingCompleted, alreadyOwned: true };
        }

        const amount = getPayableAmount(exercise);
        if (amount <= 0) {
            const purchase = await this.purchaseWithCoin(exerciseId, userId);
            return { ...purchase, paymentLink: null };
        }

        const orderCode = Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const params = new URLSearchParams({
            orderCode: String(orderCode),
            exercise: exercise._id.toString(),
            type: 'luyentap',
        });

        const paymentPayload = {
            orderCode,
            amount,
            description: `LUYENTAP${String(orderCode).slice(-10)}`,
            returnUrl: `${frontendUrl}/payment/success?${params.toString()}`,
            cancelUrl: `${frontendUrl}/payment/cancel?${params.toString()}`,
            items: [{ name: exercise.title, quantity: 1, price: amount }],
        };

        const paymentLink = await payos.paymentRequests.create(paymentPayload);

        const purchase = await PracticeExercisePurchase.findOneAndUpdate(
            { userId, exerciseId, paymentStatus: 'pending' },
            {
                $set: {
                    userId,
                    exerciseId,
                    paymentMethod: 'payos',
                    paymentStatus: 'pending',
                    orderCode,
                    amount,
                },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return {
            purchase,
            checkoutUrl: paymentLink.checkoutUrl,
            paymentLink,
            alreadyOwned: false,
        };
    }

    async completePurchaseByOrderCode(orderCode) {
        const purchase = await PracticeExercisePurchase.findOne({ orderCode: Number(orderCode) });
        if (!purchase) return null;

        if (purchase.paymentStatus !== 'completed') {
            purchase.paymentStatus = 'completed';
            purchase.paymentMethod = 'payos';
            purchase.purchasedAt = new Date();
            await purchase.save();
        }

        return purchase;
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

    async getExerciseStatistics(exerciseId, userId = null) {
        const exercise = await PracticeExercise.findById(exerciseId)
            .select('totalPoints passThreshold questions.points')
            .lean();
        if (!exercise) {
            throw new Error('Bài tập không tồn tại');
        }

        const allAnswers = await UserExerciseAnswer.find({
            exerciseId,
            ...submittedAnswerFilter(),
        })
            .select('userId percentage totalScore timeSpent submittedAt')
            .sort({ totalScore: -1, timeSpent: 1 })
            .lean();

        const bestByUser = new Map();
        for (const answer of allAnswers) {
            const uid = answer.userId.toString();
            const current = bestByUser.get(uid);
            if (!current || (Number(answer.totalScore) || 0) > (Number(current.totalScore) || 0)) {
                bestByUser.set(uid, answer);
            }
        }

        const bestScores = Array.from(bestByUser.values());
        const totalPoints = resolveExerciseTotalPoints(exercise);
        const scores = bestScores.map((item) => Number(item.totalScore) || 0);
        const totalParticipants = bestScores.length;

        const averageScore = totalParticipants > 0
            ? Math.round(scores.reduce((sum, value) => sum + value, 0) / totalParticipants)
            : 0;

        const sortedScores = [...scores].sort((a, b) => a - b);
        const medianScore = totalParticipants > 0
            ? sortedScores[Math.floor(sortedScores.length / 2)]
            : 0;

        const averageTimeSpent = allAnswers.length > 0
            ? Math.round(allAnswers.reduce((sum, item) => sum + (item.timeSpent || 0), 0) / allAnswers.length)
            : 0;

        const histogram = buildScoreHistogram(totalPoints, scores);
        const scoreRanges = buildScoreRanges(totalPoints, scores, totalParticipants);

        let userScore = null;
        if (userId) {
            const best = bestByUser.get(String(userId));
            userScore = best?.totalScore ?? null;
        }

        return {
            totalParticipants,
            totalPoints,
            averageScore,
            medianScore,
            averageTimeSpent,
            histogram,
            scoreRanges,
            userScore,
        };
    }

    async getRecentParticipants(exerciseId, page = 1, limit = 10) {
        const skip = (Math.max(1, page) - 1) * limit;
        const [answers, total] = await Promise.all([
            UserExerciseAnswer.find({
                exerciseId,
                ...submittedAnswerFilter(),
            })
                .sort({ submittedAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'fullName avatar username')
                .lean(),
            UserExerciseAnswer.countDocuments({
                exerciseId,
                ...submittedAnswerFilter(),
            }),
        ]);

        return {
            participants: answers.map((answer) => ({
                _id: answer._id,
                userId: answer.userId?._id || answer.userId,
                userName: answer.userId?.fullName || answer.userId?.username || 'Người dùng',
                userAvatar: answer.userId?.avatar || '',
                submittedAt: answer.submittedAt,
                percentage: answer.percentage || 0,
            })),
            total,
            page: Math.max(1, page),
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }

    async getExerciseReactions(exerciseId, userId = null) {
        const exercise = await PracticeExercise.findOne({ _id: exerciseId, status: 'published' })
            .select('reactions')
            .lean();
        if (!exercise) {
            throw new Error('Bài tập không tồn tại');
        }

        let userReaction = null;
        if (userId) {
            const reaction = await PracticeExerciseReaction.findOne({ exerciseId, userId }).select('type').lean();
            userReaction = reaction?.type || null;
        }

        return {
            reactionCounts: normalizeReactions(exercise.reactions),
            userReaction,
        };
    }

    async reactToExercise(exerciseId, userId, reactionType) {
        const validTypes = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'];
        if (!validTypes.includes(reactionType)) {
            throw new Error('Loại reaction không hợp lệ');
        }

        const exists = await PracticeExercise.exists({ _id: exerciseId, status: 'published' });
        if (!exists) {
            throw new Error('Bài tập không tồn tại');
        }

        const existingReaction = await PracticeExerciseReaction.findOne({ exerciseId, userId });

        if (existingReaction) {
            if (existingReaction.type === reactionType) {
                await PracticeExerciseReaction.deleteOne({ _id: existingReaction._id });
                await bumpExerciseReactionCount(exerciseId, reactionType, -1);

                return {
                    reacted: false,
                    reactionType: null,
                    reactionCounts: await getExerciseReactionCounts(exerciseId),
                };
            }

            const oldType = existingReaction.type;
            existingReaction.type = reactionType;
            await existingReaction.save();

            await bumpExerciseReactionCount(exerciseId, oldType, -1);
            await bumpExerciseReactionCount(exerciseId, reactionType, 1);

            return {
                reacted: true,
                reactionType,
                reactionCounts: await getExerciseReactionCounts(exerciseId),
            };
        }

        await PracticeExerciseReaction.create({ exerciseId, userId, type: reactionType });
        await bumpExerciseReactionCount(exerciseId, reactionType, 1);

        return {
            reacted: true,
            reactionType,
            reactionCounts: await getExerciseReactionCounts(exerciseId),
        };
    }

    async getAdminExerciseOverview(exerciseId) {
        const exercise = await PracticeExercise.findById(exerciseId)
            .populate('createdBy', 'fullName name email')
            .populate('folderId', 'name')
            .lean();
        if (!exercise) throw new Error('Bài tập không tồn tại');

        const submissionCount = await UserExerciseAnswer.countDocuments({
            exerciseId,
            ...submittedAnswerFilter(),
        });
        const pendingEssayCount = await UserExerciseAnswer.countDocuments({
            exerciseId,
            ...submittedAnswerFilter(),
            essayGradingPending: true,
        });
        const essayQuestions = (exercise.questions || []).filter((q) => q.type === 'essay');
        const essayMaxPoints = essayQuestions.reduce((sum, q) => sum + (q.points || 10), 0);
        const basicStats = await computeAdminBasicStats(exercise);

        return {
            exercise,
            submissionCount,
            pendingEssayCount,
            hasEssay: essayQuestions.length > 0,
            essayQuestionCount: essayQuestions.length,
            essayMaxPoints,
            basicStats,
        };
    }

    async getAdminExerciseDetailedStatistics(exerciseId) {
        const exercise = await PracticeExercise.findById(exerciseId)
            .select('title totalPoints passThreshold grade questions')
            .lean();
        if (!exercise) throw new Error('Bài tập không tồn tại');

        const totalPoints = resolveExerciseTotalPoints(exercise);
        const passThreshold = Number(exercise.passThreshold) || 80;
        const passScore = Math.round(((totalPoints * passThreshold) / 100) * 100) / 100;

        const allRecords = await UserExerciseAnswer.find({ exerciseId })
            .select('userId status totalScore answers submittedAt')
            .populate('userId', 'fullName username name')
            .lean();

        const registeredUserIds = new Set();
        const submittedUserIds = new Set();
        const bestAttemptsByUser = new Map();

        for (const record of allRecords) {
            const uid = String(record.userId?._id || record.userId);
            registeredUserIds.add(uid);

            if (record.status === 'in_progress') continue;

            submittedUserIds.add(uid);
            const score = Number(record.totalScore) || 0;
            const current = bestAttemptsByUser.get(uid);
            if (!current || score > (Number(current.totalScore) || 0)) {
                bestAttemptsByUser.set(uid, record);
            }
        }

        const participants = Array.from(bestAttemptsByUser.values());
        const bestScores = participants.map((item) => Number(item.totalScore) || 0);
        const distributionBuckets = buildScoreDistributionBuckets(totalPoints, bestScores);
        const averageScore = bestScores.length > 0
            ? Math.round((bestScores.reduce((sum, value) => sum + value, 0) / bestScores.length) * 100) / 100
            : 0;

        const modeBucket = distributionBuckets.reduce(
            (best, bucket) => (bucket.count > best.count ? bucket : best),
            distributionBuckets[0] || { label: '—', count: 0 },
        );

        const frequencyBuckets = buildFrequencyBucketRows(totalPoints, bestScores, participants.length);
        const aboveAverageCount = bestScores.filter((score) => score >= passScore).length;
        const groupLabel = exercise.grade ? `Khối ${exercise.grade}` : 'Thí sinh tự do';
        const frequencyGroup = {
            label: groupLabel,
            registered: registeredUserIds.size,
            participated: participants.length,
            buckets: frequencyBuckets,
            aboveAverage: {
                count: aboveAverageCount,
                percent: participants.length > 0
                    ? Math.round((aboveAverageCount / participants.length) * 100)
                    : 0,
            },
        };

        const questionStats = (exercise.questions || []).map((question, index) => {
            const correctStudents = [];
            const wrongStudents = [];
            const notAttemptedStudents = [];
            let attemptedCount = 0;
            let correctCount = 0;
            let wrongCount = 0;

            for (const submission of participants) {
                const studentName = resolveStudentName(submission.userId);
                const answerEntry = (submission.answers || []).find(
                    (entry) => String(entry.questionId) === String(question._id),
                );
                const attempted = isQuestionAttempted(question, answerEntry);

                if (!attempted) {
                    notAttemptedStudents.push(studentName);
                    continue;
                }

                attemptedCount += 1;
                if (answerEntry?.isCorrect) {
                    correctCount += 1;
                    correctStudents.push(studentName);
                } else {
                    wrongCount += 1;
                    wrongStudents.push(studentName);
                }
            }

            const totalParticipants = participants.length;
            const notAttemptedCount = notAttemptedStudents.length;
            const incompletePercent = totalParticipants > 0
                ? Math.round((notAttemptedCount / totalParticipants) * 100)
                : 0;

            return {
                index: index + 1,
                questionId: question._id,
                questionLabel: String(question._id).toUpperCase(),
                questionHtml: question.question || '',
                questionType: question.type || '',
                groupTitle: question.groupTitle || '',
                preview: buildAdminQuestionPreview(question),
                totalParticipants,
                attemptedCount,
                notAttemptedCount,
                correctCount,
                wrongCount,
                incompletePercent,
                correctStudents,
                wrongStudents,
                notAttemptedStudents,
            };
        });

        return {
            exerciseTitle: exercise.title,
            totalPoints,
            passScore,
            passThreshold,
            scoreDistribution: {
                buckets: distributionBuckets,
                averageScore,
                modeLabel: modeBucket.label,
                modeCount: modeBucket.count,
            },
            frequencyTable: {
                passScore,
                groups: [frequencyGroup],
                total: { ...frequencyGroup, label: 'TỔNG' },
            },
            questionStats,
        };
    }

    async getAdminSubmissions(exerciseId, query = {}) {
        const exercise = await PracticeExercise.findById(exerciseId).lean();
        if (!exercise) throw new Error('Bài tập không tồn tại');

        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
        const search = (query.search || '').trim().toLowerCase();

        const allSubmitted = await UserExerciseAnswer.find({
            exerciseId,
            ...submittedAnswerFilter(),
        })
            .sort({ submittedAt: 1 })
            .select('_id userId submittedAt')
            .lean();

        const attemptMap = new Map();
        const userCounter = new Map();
        allSubmitted.forEach((row) => {
            const uid = String(row.userId);
            const next = (userCounter.get(uid) || 0) + 1;
            userCounter.set(uid, next);
            attemptMap.set(String(row._id), next);
        });

        let answers = await UserExerciseAnswer.find({
            exerciseId,
            ...submittedAnswerFilter(),
        })
            .sort({ submittedAt: -1 })
            .populate('userId', 'fullName avatar username email')
            .lean();

        if (search) {
            answers = answers.filter((answer) => {
                const user = answer.userId || {};
                const name = (user.fullName || user.username || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                return name.includes(search) || email.includes(search);
            });
        }

        const essayQuestions = (exercise.questions || []).filter((q) => q.type === 'essay');
        const essayMaxPoints = essayQuestions.reduce((sum, q) => sum + (q.points || 10), 0);
        const total = answers.length;
        const skip = (page - 1) * limit;
        const paged = answers.slice(skip, skip + limit);

        return {
            submissions: paged.map((answer) => ({
                _id: answer._id,
                userId: answer.userId?._id || answer.userId,
                userName: answer.userId?.fullName || answer.userId?.username || 'Người dùng',
                userAvatar: answer.userId?.avatar || '',
                userEmail: answer.userId?.email || '',
                totalScore: answer.totalScore ?? null,
                percentage: answer.percentage ?? null,
                timeSpent: answer.timeSpent || 0,
                submittedAt: answer.submittedAt,
                tabSwitchCount: answer.tabSwitchCount || 0,
                essayGradingPending: Boolean(answer.essayGradingPending),
                overallFeedback: answer.overallFeedback || '',
                attemptNumber: attemptMap.get(String(answer._id)) || 1,
            })),
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            hasEssay: essayQuestions.length > 0,
            essayMaxPoints,
            totalPoints: resolveExerciseTotalPoints(exercise),
        };
    }

    async getAdminSubmissionDetail(exerciseId, answerId) {
        const exercise = await PracticeExercise.findById(exerciseId).lean();
        if (!exercise) throw new Error('Bài tập không tồn tại');

        const userAnswer = await UserExerciseAnswer.findOne({
            _id: answerId,
            exerciseId,
            ...submittedAnswerFilter(),
        })
            .populate('userId', 'fullName avatar username email')
            .lean();
        if (!userAnswer) throw new Error('Bài làm không tồn tại');

        const essayQuestions = (exercise.questions || []).filter((q) => q.type === 'essay');
        const essayItems = essayQuestions.map((question) => {
            const answerEntry = (userAnswer.answers || []).find(
                (entry) => String(entry.questionId) === String(question._id),
            );
            return {
                questionId: question._id,
                question: question.question,
                points: question.points || 10,
                sampleAnswer: question.sampleAnswer || '',
                essayAnswer: answerEntry?.essayAnswer || '',
                awardedPoints: answerEntry?.points ?? 0,
                feedback: answerEntry?.feedback || '',
                needsManualGrading: Boolean(answerEntry?.needsManualGrading),
                gradedAt: answerEntry?.gradedAt || null,
            };
        });

        const detailedAnswers = buildDetailedAnswersForResult(
            exercise,
            userAnswer.answers,
            true,
        );

        return {
            submission: {
                _id: userAnswer._id,
                userId: userAnswer.userId?._id || userAnswer.userId,
                userName: userAnswer.userId?.fullName || userAnswer.userId?.username || 'Người dùng',
                userAvatar: userAnswer.userId?.avatar || '',
                userEmail: userAnswer.userId?.email || '',
                totalScore: userAnswer.totalScore ?? null,
                percentage: userAnswer.percentage ?? null,
                timeSpent: userAnswer.timeSpent || 0,
                submittedAt: userAnswer.submittedAt,
                tabSwitchCount: userAnswer.tabSwitchCount || 0,
                essayGradingPending: Boolean(userAnswer.essayGradingPending),
                overallFeedback: userAnswer.overallFeedback || '',
                attemptNumber: 0,
            },
            answers: detailedAnswers,
            exercise: {
                title: exercise.title,
                questions: exercise.questions || [],
            },
            essayItems,
            totalPoints: resolveExerciseTotalPoints(exercise),
            essayMaxPoints: essayQuestions.reduce((sum, q) => sum + (q.points || 10), 0),
        };
    }

    async gradeEssayAnswers(exerciseId, answerId, graderId, grades = [], overallFeedback) {
        const exercise = await PracticeExercise.findById(exerciseId);
        if (!exercise) throw new Error('Bài tập không tồn tại');

        const userAnswer = await UserExerciseAnswer.findOne({
            _id: answerId,
            exerciseId,
            status: 'submitted',
        });
        if (!userAnswer) throw new Error('Bài làm không tồn tại');

        if (overallFeedback !== undefined) {
            userAnswer.overallFeedback = String(overallFeedback || '').trim();
        }

        if (!Array.isArray(grades) || grades.length === 0) {
            if (overallFeedback === undefined) {
                throw new Error('Thiếu dữ liệu chấm điểm');
            }
            await userAnswer.save();
            return {
                submission: {
                    _id: userAnswer._id,
                    totalScore: userAnswer.totalScore ?? null,
                    percentage: userAnswer.percentage ?? null,
                    essayGradingPending: Boolean(userAnswer.essayGradingPending),
                    overallFeedback: userAnswer.overallFeedback || '',
                },
            };
        }

        grades.forEach((grade) => {
            const question = exercise.questions.id(grade.questionId)
                || exercise.questions.find((q) => q._id.toString() === String(grade.questionId));
            if (!question || question.type !== 'essay') return;

            const answerEntry = userAnswer.answers.find(
                (entry) => String(entry.questionId) === String(question._id),
            );
            if (!answerEntry) return;

            const maxPoints = question.points || 10;
            const points = Math.min(Math.max(0, Number(grade.points) || 0), maxPoints);
            answerEntry.points = points;
            answerEntry.isCorrect = points >= maxPoints * 0.5;
            answerEntry.feedback = (grade.feedback || '').trim();
            answerEntry.needsManualGrading = false;
            answerEntry.gradedAt = new Date();
        });

        userAnswer.totalScore = userAnswer.answers.reduce(
            (sum, entry) => sum + (Number(entry.points) || 0),
            0,
        );
        userAnswer.essayGradingPending = userAnswer.answers.some((entry) => {
            const question = exercise.questions.id(entry.questionId)
                || exercise.questions.find((q) => q._id.toString() === String(entry.questionId));
            return question?.type === 'essay' && entry.needsManualGrading;
        });
        userAnswer.percentage = computeExercisePassPercentage(userAnswer.totalScore, exercise, {
            essayGradingPending: userAnswer.essayGradingPending,
            essayMaxPoints: resolveEssayMaxPoints(exercise),
        });

        await userAnswer.save();

        if (!userAnswer.essayGradingPending) {
            try {
                const { createNotification } = require('../notification/notification.service');
                await createNotification({
                    userId: userAnswer.userId,
                    senderId: graderId,
                    type: 'exercise_essay_graded',
                    content: `Giáo viên đã chấm xong phần tự luận bài "${exercise.title}". Điểm: ${Math.round(userAnswer.percentage)}%`,
                    meta: {
                        url: `/luyentap/${exercise.slug}/check?answerId=${userAnswer._id}`,
                        exerciseId: String(exercise._id),
                        exerciseSlug: exercise.slug,
                        exerciseTitle: exercise.title,
                        answerId: String(userAnswer._id),
                        percentage: userAnswer.percentage,
                        totalScore: userAnswer.totalScore,
                    },
                });
            } catch (err) {
                console.error('Essay graded notification error:', err);
            }
        }

        return userAnswer.toObject();
    }
}

module.exports = new LuyenTapService();
