const { runAlgorithmCode, gradeWebCode } = require('../luyentap/luyentap.codeRunner');

function normalizeText(value) {
    return String(value || '').trim().toLowerCase().replace(/[-,\s]/g, '');
}

function stripHtml(html) {
    return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseMatchingAnswer(raw) {
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function gradeQuiz(question, answer) {
    const letter = String(answer || '').trim().toUpperCase();
    const isCorrect = (question.correctAnswers || []).some(
        (item) => String(item).trim().toUpperCase() === letter,
    );
    return { isCorrect, points: isCorrect ? (question.score || 1) : 0 };
}

function gradeMultipleSelect(question, answer) {
    const selected = new Set(
        String(answer || '')
            .split(',')
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean),
    );
    const correct = new Set(
        (question.correctAnswers || []).map((item) => String(item).trim().toUpperCase()).filter(Boolean),
    );
    const isCorrect =
        selected.size === correct.size && [...correct].every((letter) => selected.has(letter));
    return { isCorrect, points: isCorrect ? (question.score || 1) : 0 };
}

function gradeTrueFalse(question, answer, trueFalseScale) {
    const correctAnswers = question.correctAnswers || [];
    const answerStr = String(answer || '');

    if (correctAnswers[0]?.includes(':')) {
        const userAnswers = answerStr.split(',').sort().join(',');
        const correctAnswersStr = [...correctAnswers].sort().join(',');
        const isCorrect = userAnswers === correctAnswersStr;
        return { isCorrect, points: isCorrect ? (question.score || 1) : 0 };
    }

    const userMap = {};
    answerStr.split(',').forEach((part) => {
        const [letter, value] = part.split(':');
        if (letter && value !== undefined) userMap[letter.toLowerCase()] = value === 'true';
    });

    const options = question.options || [];
    let correctCount = 0;

    options.forEach((opt, index) => {
        const match = String(opt).trim().match(/^([a-d])[).]/i);
        const letter = match ? match[1].toLowerCase() : String.fromCharCode(97 + index);
        let expected = false;

        if (correctAnswers[0]?.includes('true') || correctAnswers[0]?.includes('false')) {
            expected = correctAnswers[index] === 'true';
        } else {
            expected = correctAnswers.some(
                (item) => item.toLowerCase() === letter || item.toLowerCase().startsWith(`${letter}:`),
            );
        }

        if (userMap[letter] === expected) correctCount += 1;
    });

    const total = options.length;
    const isCorrect = total > 0 && correctCount === total;
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
    const points = Math.round(((question.score || 1) * percent) / 100 * 100) / 100;

    return { isCorrect, points, correctCount, total };
}

function gradeShortAnswer(question, answer) {
    const isCorrect = normalizeText(answer) === normalizeText(question.correctAnswers?.[0] || question.correctAnswer || '');
    return { isCorrect, points: isCorrect ? (question.score || 1) : 0 };
}

function gradeMatching(question, answer) {
    const userPairs = parseMatchingAnswer(answer);
    const leftItems = question.leftItems || [];
    const expected = question.matchingPairs || [];

    if (expected.length === 0) {
        const hasPairs = userPairs.length > 0;
        return { isCorrect: hasPairs, points: hasPairs ? (question.score || 1) : 0 };
    }

    const userKeys = new Set(
        userPairs.map((pair) => `${pair.leftIndex + 1}-${String.fromCharCode(97 + pair.rightIndex)}`),
    );

    const isCorrect = expected.every((pair) =>
        userKeys.has(`${pair.left}-${String(pair.right).toLowerCase()}`),
    );

    return { isCorrect, points: isCorrect ? (question.score || 1) : 0 };
}

function gradeEssay(_question, answer) {
    const hasAnswer = stripHtml(answer).length > 0;
    return {
        isCorrect: hasAnswer,
        points: hasAnswer ? (_question.score || 1) : 0,
        needsManualGrading: false,
    };
}

async function gradeCodeQuestion(question, answer) {
    const points = question.score || 1;
    const code = String(answer || '');

    if (question.codeMode === 'web' || question.type === 'code') {
        if (question.codeMode === 'web') {
            const result = gradeWebCode(code, question.webRequirements || []);
            return {
                isCorrect: result.passed,
                points: result.passed ? points : 0,
                feedback: result.passed ? 'Đạt yêu cầu' : 'Chưa đạt yêu cầu đề bài',
            };
        }
    }

    const testCases = (question.testCases || []).filter(
        (tc) => tc.input?.trim() || tc.expectedOutput?.trim(),
    );

    if (testCases.length === 0) {
        const hasCode = code.trim().length > 0;
        return { isCorrect: hasCode, points: hasCode ? points : 0, feedback: '' };
    }

    for (const tc of testCases) {
        const result = await runAlgorithmCode({
            language: question.language || 'python',
            code,
            input: tc.input || '',
            expectedOutput: tc.expectedOutput || '',
        });
        if (!result.passed) {
            return {
                isCorrect: false,
                points: 0,
                feedback: result.error || 'Test case thất bại',
            };
        }
    }

    return { isCorrect: true, points, feedback: 'Tất cả test case đạt' };
}

async function gradeCourseExerciseQuestion(question, answer, trueFalseScale) {
    const type = question.type;

    if (type === 'quiz' || type === 'multiple-choice') return gradeQuiz(question, answer);
    if (type === 'multiple-select') return gradeMultipleSelect(question, answer);
    if (type === 'true-false') return gradeTrueFalse(question, answer, trueFalseScale);
    if (type === 'short-answer') return gradeShortAnswer(question, answer);
    if (type === 'matching') return gradeMatching(question, answer);
    if (type === 'essay') return gradeEssay(question, answer);
    if (type === 'ide' || type === 'code') return gradeCodeQuestion(question, answer);

    return { isCorrect: false, points: 0 };
}

module.exports = {
    gradeCourseExerciseQuestion,
};
