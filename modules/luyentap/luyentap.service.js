const { PracticeExercise, UserExerciseAnswer } = require('./luyentap.model');
const slugify = require('slugify');
const mongoose = require('mongoose');

class LuyenTapService {
    // ===== ADMIN =====
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
        const { page = 1, limit = 10, status } = query;
        const filter = status ? { status } : {};

        const exercises = await PracticeExercise.find(filter)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await PracticeExercise.countDocuments(filter);

        return { exercises, total, page: parseInt(page), limit: parseInt(limit) };
    }

    async getExerciseById(id) {
        return await PracticeExercise.findById(id).populate('createdBy', 'name email');
    }

    // ===== PUBLIC =====
    async getPublicExercises(query = {}) {
        const { page = 1, limit = 10 } = query;

        const exercises = await PracticeExercise.find({ status: 'published' })
            .select('title slug description thumbnail duration totalPoints participantCount')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await PracticeExercise.countDocuments({ status: 'published' });

        return { exercises, total, page: parseInt(page), limit: parseInt(limit) };
    }

    async getExerciseBySlug(slug) {
        return await PracticeExercise.findOne({ slug, status: 'published' })
            .select('title slug description thumbnail duration totalPoints participantCount');
    }

    async getPublicExerciseById(id) {
        return await PracticeExercise.findOne({ _id: id, status: 'published' })
            .select('title slug description thumbnail duration totalPoints participantCount questions');
    }

    async getExerciseForTaking(id) {
        const exercise = await PracticeExercise.findById(id);
        if (!exercise || PracticeExercise.status !== 'published') {
            throw new Error('Exercise not found or not published');
        }

        return exercise;
    }

    // ===== USER SUBMISSION =====
    async submitAnswer(exerciseId, userId, answers, timeSpent) {
        const exercise = await PracticeExercise.findById(exerciseId);
        if (!exercise) {
            throw new Error('Exercise not found');
        }

        // Check max attempts
        if (PracticeExercise.maxAttempts > 0) {
            const attemptCount = await UserExerciseAnswer.countDocuments({ exerciseId, userId });
            if (attemptCount >= PracticeExercise.maxAttempts) {
                throw new Error(`Bạn đã đạt số lần làm bài tối đa (${PracticeExercise.maxAttempts})`);
            }
        }

        // Calculate score
        let totalScore = 0;
        const processedAnswers = answers.map((answer, index) => {
            const question = PracticeExercise.questions[index];
            if (!question) return null;

            let isCorrect = false;
            let points = 0;

            if (question.type === 'multiple-choice') {
                const selectedOption = question.options.find(
                    opt => opt._id.toString() === answer.selectedOption
                );
                isCorrect = selectedOption && selectedOption.isCorrect;
            } else if (question.type === 'true-false') {
                const userAnswers = answer.trueFalseAnswers || [];
                isCorrect = userAnswers.every((ua, i) => {
                    const correctOption = question.trueFalseOptions[i];
                    return correctOption && ua.isTrue === correctOption.isCorrect;
                }) && userAnswers.length === question.trueFalseOptions.length;
            } else if (question.type === 'short-answer') {
                const userAnswer = answer.shortAnswer?.trim().toLowerCase().replace(/[-,]/g, '');
                const correctAnswer = question.correctAnswer?.trim().toLowerCase().replace(/[-,]/g, '');
                isCorrect = userAnswer === correctAnswer;
            }

            points = isCorrect ? 10 : 0;
            totalScore += points;

            return {
                questionId: question._id,
                ...answer,
                isCorrect,
                points
            };
        }).filter(Boolean);

        // Calculate percentage
        const percentage = PracticeExercise.totalPoints > 0 ? (totalScore / PracticeExercise.totalPoints) * 100 : 0;

        // Award coins if score >= 80%
        let coinsAwarded = 0;
        if (percentage >= 80) {
            coinsAwarded = Math.floor(Math.random() * 51); // 0-50 coins
            // Update user's coins
            const User = mongoose.model('User');
            const user = await User.findByIdAndUpdate(userId, {
                $inc: { coins: coinsAwarded }
            }, { new: true });

            // Record coin transaction
            if (user) {
                const CoinTransaction = require('../coin/coin.model');
                await CoinTransaction.create({
                    userId,
                    type: 'credit',
                    amount: coinsAwarded,
                    reason: `Hoàn thành bài tập "${PracticeExercise.title}" với điểm số ${percentage.toFixed(0)}%`,
                    relatedId: exerciseId,
                    relatedType: 'exercise',
                    balanceAfter: user.coins
                });
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

        // Update participant count only for first attempt
        const isFirstAttempt = await UserExerciseAnswer.countDocuments({ exerciseId, userId }) === 1;
        if (isFirstAttempt) {
            await PracticeExercise.findByIdAndUpdate(exerciseId, {
                $inc: { participantCount: 1 }
            });
        }

        return userAnswer;
    }

    // ===== LEADERBOARD =====
    async getExerciseLeaderboard(exerciseId, limit = 50) {
        // Get all answers for this exercise, sorted by score desc, time asc
        const allAnswers = await UserExerciseAnswer.aggregate([
            { $match: { exerciseId: new mongoose.Types.ObjectId(exerciseId) } },
            { $sort: { totalScore: -1, timeSpent: 1 } }
        ]);

        // Keep only best score per user (first occurrence is best due to sorting)
        const seenUsers = new Set();
        const bestScores = [];

        for (const answer of allAnswers) {
            if (!seenUsers.has(answer.userId.toString())) {
                seenUsers.add(answer.userId.toString());
                bestScores.push(answer);
                if (bestScores.length >= limit) break;
            }
        }

        // Get user details
        const userIds = bestScores.map(s => s.userId);
        const users = await mongoose.model('User').find({ _id: { $in: userIds } });
        const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

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
        // Get best score per user per exercise, then sum for overall
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
            {
                $sort: { totalScore: -1, totalTimeSpent: 1 }
            },
            {
                $limit: limit
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
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

        return leaderboard.map((entry, index) => ({
            rank: index + 1,
            ...entry
        }));
    }

    // ===== USER RESULTS =====
    async getUserAnswer(exerciseId, userId, answerId = null) {
        const query = { exerciseId, userId };

        // If answerId is provided, get specific attempt
        if (answerId) {
            query._id = answerId;
        }

        const userAnswer = await UserExerciseAnswer.findOne(query)
            .populate('exerciseId')
            .populate('userId', 'name email avatar')
            .sort({ submittedAt: -1 }); // Get most recent if no answerId

        if (!userAnswer) {
            throw new Error('Answer not found');
        }

        const exercise = await PracticeExercise.findById(exerciseId);

        const detailedAnswers = userAnswer.answers.map(answer => {
            const question = PracticeExercise.questions.find(q =>
                q._id.toString() === answer.questionId.toString()
            );

            return {
                ...answer.toObject(),
                question: question ? {
                    type: question.type,
                    question: question.question,
                    explanation: question.explanation,
                    options: question.options,
                    trueFalseOptions: question.trueFalseOptions,
                    correctAnswer: question.correctAnswer
                } : null
            };
        });

        return {
            ...userAnswer.toObject(),
            answers: detailedAnswers
        };
    }

    async getUserExercises(userId) {
        const userAnswers = await UserExerciseAnswer.find({ userId })
            .populate('exerciseId', 'title slug thumbnail totalPoints')
            .sort({ submittedAt: -1 });

        return userAnswers;
    }

    async getUserExerciseHistory(exerciseId, userId) {
        const submissions = await UserExerciseAnswer.find({ exerciseId, userId })
            .select('_id totalScore percentage coinsAwarded timeSpent submittedAt')
            .sort({ submittedAt: -1 })
            .lean();
        return submissions;
    }

    async checkUserAttempts(exerciseId, userId) {
        const exercise = await PracticeExercise.findById(exerciseId);
        if (!exercise) {
            throw new Error('Exercise not found');
        }

        const attemptCount = await UserExerciseAnswer.countDocuments({ exerciseId, userId });

        return {
            attemptCount,
            maxAttempts: PracticeExercise.maxAttempts,
            canAttempt: PracticeExercise.maxAttempts === 0 || attemptCount < PracticeExercise.maxAttempts,
            remainingAttempts: PracticeExercise.maxAttempts === 0 ? null : Math.max(0, PracticeExercise.maxAttempts - attemptCount)
        };
    }
}

module.exports = new LuyenTapService();
