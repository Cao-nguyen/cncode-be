function resolveExerciseAvailability(exercise, now = new Date()) {
    const from = exercise?.deliveryFrom ? new Date(exercise.deliveryFrom) : null;
    const to = exercise?.deliveryTo ? new Date(exercise.deliveryTo) : null;

    if (from && !Number.isNaN(from.getTime()) && now < from) {
        return {
            phase: 'upcoming',
            canEnter: false,
            message: 'Chưa đến thời gian mở đề',
        };
    }

    if (to && !Number.isNaN(to.getTime()) && now > to) {
        return {
            phase: 'closed',
            canEnter: false,
            message: 'Đã kết thúc',
        };
    }

    return {
        phase: 'open',
        canEnter: true,
        message: null,
    };
}

function isExerciseDeliveryExpired(exercise, now = new Date()) {
    const to = exercise?.deliveryTo ? new Date(exercise.deliveryTo) : null;
    return Boolean(to && !Number.isNaN(to.getTime()) && now > to);
}

function hasExamPassword(exercise) {
    return Boolean(String(exercise?.examPassword || '').trim());
}

function verifyExamPassword(exercise, password) {
    if (!hasExamPassword(exercise)) return true;
    return String(password || '').trim() === String(exercise.examPassword || '').trim();
}

function canRevealScore(exercise, now = new Date(), hasSubmitted = true) {
    if (!hasSubmitted) return false;
    const when = exercise?.showScoreWhen || 'after-submit';
    if (when === 'never') return false;
    if (when === 'after-submit') return true;
    if (when === 'after-expiry') return isExerciseDeliveryExpired(exercise, now);
    return false;
}

function canRevealAnswers(exercise, now = new Date(), hasSubmitted = true) {
    if (!hasSubmitted) return false;
    const when = exercise?.showAnswersWhen || 'never';
    if (when === 'never') return false;
    if (when === 'after-submit') return true;
    if (when === 'after-expiry') return isExerciseDeliveryExpired(exercise, now);
    return false;
}

function sanitizeQuestionForResult(question, revealAnswers) {
    if (!question) return null;
    if (revealAnswers) {
        return {
            _id: question._id,
            type: question.type,
            question: question.question,
            explanation: question.explanation,
            groupTitle: question.groupTitle,
            options: question.options,
            trueFalseOptions: question.trueFalseOptions,
            correctAnswer: question.correctAnswer,
            leftItems: question.leftItems,
            rightItems: question.rightItems,
            matchingPairs: question.matchingPairs,
            sampleAnswer: question.sampleAnswer,
            language: question.language,
            codeMode: question.codeMode,
            starterCode: question.starterCode,
            testCases: question.testCases?.map((tc) => ({
                _id: tc._id,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isSample: Boolean(tc.isSample),
            })),
            webRequirements: question.webRequirements?.map(({ type, selector, tag, property, value, text }) => ({
                type, selector, tag, property, value, text,
            })),
        };
    }

    return {
        _id: question._id,
        type: question.type,
        question: question.question,
        groupTitle: question.groupTitle,
        options: question.options?.map((opt) => ({
            _id: opt._id,
            text: opt.text,
        })),
        trueFalseOptions: question.trueFalseOptions?.map((opt) => ({
            _id: opt._id,
            text: opt.text,
        })),
        leftItems: question.leftItems,
        rightItems: question.rightItems,
        language: question.language,
        codeMode: question.codeMode,
        starterCode: question.starterCode,
        testCases: question.testCases
            ?.filter((tc) => tc.isSample)
            ?.map((tc) => ({
                _id: tc._id,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isSample: true,
            })),
        webRequirements: question.webRequirements?.map(({ type, selector, tag, property, value, text }) => ({
            type, selector, tag, property, value, text,
        })),
    };
}

function sanitizePublicExerciseSettings(exercise) {
    return {
        deliveryFrom: exercise.deliveryFrom,
        deliveryTo: exercise.deliveryTo,
        maxAttempts: exercise.maxAttempts || 0,
        hasExamPassword: hasExamPassword(exercise),
        proctoring: exercise.proctoring || 'off',
        shuffleQuestions: Boolean(exercise.shuffleQuestions),
        shuffleAnswers: Boolean(exercise.shuffleAnswers),
        showScoreWhen: exercise.showScoreWhen || 'after-submit',
        showAnswersWhen: exercise.showAnswersWhen || 'never',
        hideLeaderboard: Boolean(exercise.hideLeaderboard),
        preExamNoticeEnabled: Boolean(exercise.preExamNoticeEnabled),
        preExamNotice: exercise.preExamNoticeEnabled ? (exercise.preExamNotice || '') : '',
    };
}

module.exports = {
    resolveExerciseAvailability,
    isExerciseDeliveryExpired,
    hasExamPassword,
    verifyExamPassword,
    canRevealScore,
    canRevealAnswers,
    sanitizeQuestionForResult,
    sanitizePublicExerciseSettings,
};
