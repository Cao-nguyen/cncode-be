const Exercise = require('./baitap.model');

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

    // Convert legacy format to new format
    normalizeQuestion(question) {
        // If already has new format, return as-is
        if (question.options && question.options.length > 0 && question.correctAnswers) {
            return question;
        }

        // Convert legacy format to new format
        const normalized = { ...question.toObject() };

        if (question.type === 'quiz' && question.legacyOptions) {
            normalized.options = question.legacyOptions.map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                return `${letter}. ${opt.text}`;
            });
            normalized.correctAnswers = question.legacyOptions
                .map((opt, i) => opt.isCorrect ? String.fromCharCode(65 + i) : null)
                .filter(Boolean);
        } else if (question.type === 'true-false' && question.trueFalseOptions) {
            normalized.options = question.trueFalseOptions.map((opt, i) => {
                const letter = String.fromCharCode(97 + i);
                return `${letter}. ${opt.text}`;
            });
            normalized.correctAnswers = question.trueFalseOptions
                .map((opt, i) => {
                    const letter = String.fromCharCode(97 + i);
                    return `${letter}:${opt.isCorrect}`;
                });
        } else if (question.type === 'short-answer' && question.correctAnswer) {
            normalized.correctAnswers = [question.correctAnswer];
        }

        return normalized;
    }

    async checkAnswer(exerciseId, userAnswers) {
        const exercise = await Exercise.findById(exerciseId);
        if (!exercise) return { isCorrect: false, error: 'Exercise not found' };

        // Normalize questions to new format
        const normalizedQuestions = exercise.questions.map(q => this.normalizeQuestion(q));

        // userAnswers = [{ questionId, answer }, ...]
        const results = normalizedQuestions.map((question, index) => {
            const userAnswer = userAnswers.find(ua => ua.questionId === question._id.toString());
            if (!userAnswer) return { questionId: question._id, isCorrect: false };

            let isCorrect = false;

            switch (question.type) {
                case 'quiz':
                    // New format: userAnswer.answer = "A", correctAnswers = ["A"]
                    isCorrect = question.correctAnswers?.includes(userAnswer.answer);
                    break;

                case 'true-false':
                    // New format: userAnswer.answer = "a:true,b:false", correctAnswers = ["a:true", "b:false"]
                    const userAnswersArray = userAnswer.answer.split(',').sort().join(',');
                    const correctAnswersArray = question.correctAnswers?.sort().join(',') || '';
                    isCorrect = userAnswersArray === correctAnswersArray;
                    break;

                case 'short-answer':
                    // Normalize: lowercase, remove '-' and ','
                    const normalize = (str) => str.toLowerCase().replace(/[-,]/g, '');
                    const userAnswerNormalized = normalize(userAnswer.answer);
                    const correctAnswerNormalized = normalize(question.correctAnswers?.[0] || '');
                    isCorrect = userAnswerNormalized === correctAnswerNormalized;
                    break;

                case 'ide':
                    // userAnswer.answer = user's code
                    // This would need actual code execution, simplified here
                    // In production, use a sandboxed environment to run code against test cases
                    isCorrect = false; // Placeholder - needs implementation
                    break;
            }

            return { questionId: question._id, isCorrect };
        });

        const allCorrect = results.every(r => r.isCorrect);

        return {
            results,
            allCorrect,
            canProceed: allCorrect || !exercise.mustPassToNext
        };
    }
}

module.exports = new ExerciseService();