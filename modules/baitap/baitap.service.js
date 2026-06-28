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

    async checkAnswer(exerciseId, userAnswers) {
        const exercise = await Exercise.findById(exerciseId);
        if (!exercise) return { isCorrect: false, error: 'Exercise not found' };

        // userAnswers = [{ questionId, answer }, ...]
        const results = exercise.questions.map(question => {
            const userAnswer = userAnswers.find(ua => ua.questionId === question._id.toString());
            if (!userAnswer) return { questionId: question._id, isCorrect: false };

            let isCorrect = false;

            switch (question.type) {
                case 'quiz':
                    // User answers with option index or id
                    const selectedOption = question.options[userAnswer.answer] ||
                        question.options.find(opt => opt._id.toString() === userAnswer.answer);
                    isCorrect = selectedOption && selectedOption.isCorrect === true;
                    break;

                case 'true-false':
                    // userAnswer.answer = [{optionId, answer: true/false}, ...]
                    const tfOptions = question.trueFalseOptions || [];
                    isCorrect = userAnswer.answer.every(ua => {
                        const option = tfOptions.find(opt => opt._id.toString() === ua.optionId);
                        return option && option.isCorrect === ua.answer;
                    });
                    break;

                case 'short-answer':
                    // Normalize: lowercase, remove '-' and ','
                    const normalize = (str) => str.toLowerCase().replace(/[-,]/g, '');
                    isCorrect = normalize(userAnswer.answer) === normalize(question.correctAnswer);
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