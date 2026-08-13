const Exercise = require('./baitap.model');
const { gradeCourseExerciseQuestion } = require('./courseExerciseGrading');

class ExerciseService {
    async create(data) {
        const exercise = new Exercise(data);
        await exercise.save();
        return exercise;
    }

    async getById(id) {
        return Exercise.findById(id);
    }

    async getByLessonId(lessonId) {
        return Exercise.findOne({ lessonId });
    }

    async update(id, data) {
        return Exercise.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id) {
        return Exercise.findByIdAndDelete(id);
    }

    normalizeQuestion(question) {
        const raw = question.toObject ? question.toObject() : { ...question };

        if (raw.options?.length && raw.correctAnswers?.length) {
            return raw;
        }

        const normalized = { ...raw };

        if (raw.type === 'quiz' && raw.legacyOptions) {
            normalized.options = raw.legacyOptions.map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                return `${letter}. ${opt.text}`;
            });
            normalized.correctAnswers = raw.legacyOptions
                .map((opt, i) => (opt.isCorrect ? String.fromCharCode(65 + i) : null))
                .filter(Boolean);
        } else if (raw.type === 'true-false' && raw.trueFalseOptions) {
            normalized.options = raw.trueFalseOptions.map((opt, i) => {
                const letter = String.fromCharCode(97 + i);
                return `${letter}. ${opt.text}`;
            });
            normalized.correctAnswers = raw.trueFalseOptions.map((opt, i) => {
                const letter = String.fromCharCode(97 + i);
                return `${letter}:${opt.isCorrect}`;
            });
        } else if (raw.type === 'short-answer' && raw.correctAnswer) {
            normalized.correctAnswers = [raw.correctAnswer];
        }

        return normalized;
    }

    normalizeUserAnswers(userAnswers) {
        if (Array.isArray(userAnswers)) return userAnswers;

        if (userAnswers && typeof userAnswers === 'object') {
            if (Array.isArray(userAnswers.answers)) return userAnswers.answers;
            if (userAnswers.questionId) return [userAnswers];
        }

        return [];
    }

    resolveQuestionId(question, index) {
        return question._id ? String(question._id) : String(index);
    }

    async checkAnswer(exerciseId, userAnswersInput) {
        const exercise = await Exercise.findById(exerciseId);
        if (!exercise) {
            return { isCorrect: false, allCorrect: false, canProceed: false, error: 'Exercise not found' };
        }

        const userAnswers = this.normalizeUserAnswers(userAnswersInput);
        const normalizedQuestions = exercise.questions.map((q) => this.normalizeQuestion(q));

        let totalScore = 0;
        let maxScore = 0;

        const results = [];

        for (let index = 0; index < normalizedQuestions.length; index += 1) {
            const question = normalizedQuestions[index];
            const questionId = this.resolveQuestionId(question, index);
            maxScore += question.score || 1;

            const userAnswer = userAnswers.find(
                (item) => String(item.questionId) === questionId || String(item.questionId) === String(index),
            );

            if (!userAnswer || userAnswer.answer === undefined || userAnswer.answer === null || userAnswer.answer === '') {
                results.push({ questionId, isCorrect: false, points: 0, feedback: 'Chưa trả lời' });
                continue;
            }

            const graded = await gradeCourseExerciseQuestion(
                question,
                userAnswer.answer,
                exercise.trueFalseScale,
            );

            totalScore += graded.points || 0;
            results.push({
                questionId,
                isCorrect: graded.isCorrect,
                points: graded.points || 0,
                feedback: graded.feedback || '',
                needsManualGrading: graded.needsManualGrading || false,
            });
        }

        const allCorrect = results.length > 0 && results.every((item) => item.isCorrect);

        return {
            results,
            allCorrect,
            isCorrect: allCorrect,
            canProceed: allCorrect || !exercise.mustPassToNext,
            totalScore,
            maxScore,
        };
    }
}

module.exports = new ExerciseService();
