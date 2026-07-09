const { Contest, UserAnswer } = require('./dautruong.model');
const slugify = require('slugify');
const mongoose = require('mongoose');

class DauTruongService {
    // ===== ADMIN =====
    async createContest(data) {
        const slug = slugify(data.title, { lower: true, strict: true });
        const contest = new Contest({
            ...data,
            slug,
            createdBy: data.createdBy
        });
        return await contest.save();
    }

    async updateContest(id, data) {
        console.log('updateContest called with id:', id, 'data:', data);
        if (data.title) {
            data.slug = slugify(data.title, { lower: true, strict: true });
        }
        const result = await Contest.findByIdAndUpdate(id, data, { new: true });
        console.log('updateContest result:', result);
        return result;
    }

    async deleteContest(id) {
        await Contest.findByIdAndDelete(id);
        await UserAnswer.deleteMany({ contestId: id });
    }

    async getAdminContests(query = {}) {
        const { page = 1, limit = 10, status } = query;
        const filter = status ? { status } : {};

        const contests = await Contest.find(filter)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Contest.countDocuments(filter);

        return { contests, total, page: parseInt(page), limit: parseInt(limit) };
    }

    async getContestById(id) {
        return await Contest.findById(id).populate('createdBy', 'name email');
    }

    // ===== PUBLIC =====
    async getPublicContests(query = {}) {
        const { page = 1, limit = 10 } = query;
        console.log('getPublicContests called with query:', query);

        // Debug: Check all contests and their statuses
        const allContests = await Contest.find({}, 'title status');
        console.log('All contests in database:', allContests.map(c => ({ id: c._id, title: c.title, status: c.status })));

        const contests = await Contest.find({ status: 'published' })
            .select('title slug description thumbnail startTime endTime duration totalPoints participantCount')
            .sort({ startTime: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        console.log('getPublicContests found contests:', contests.length, contests);

        const total = await Contest.countDocuments({ status: 'published' });
        console.log('getPublicContests total:', total);

        return { contests, total, page: parseInt(page), limit: parseInt(limit) };
    }

    async getContestBySlug(slug) {
        return await Contest.findOne({ slug, status: 'published' })
            .select('title slug description thumbnail startTime endTime duration totalPoints participantCount');
    }

    async getPublicContestById(id) {
        return await Contest.findOne({ _id: id, status: 'published' })
            .select('title slug description thumbnail startTime endTime duration totalPoints participantCount questions');
    }

    async getContestForTaking(id) {
        console.log('getContestForTaking called with id:', id);
        const contest = await Contest.findById(id);
        console.log('getContestForTaking contest:', contest);
        console.log('getContestForTaking contest.questions:', contest?.questions);
        if (!contest || contest.status !== 'published') {
            throw new Error('Contest not found or not published');
        }

        const now = new Date();
        if (now < contest.startTime) {
            throw new Error('Contest has not started yet');
        }
        if (contest.endTime && now > contest.endTime) {
            throw new Error('Contest has ended');
        }

        return contest;
    }

    // ===== USER SUBMISSION =====
    async submitAnswer(contestId, userId, answers, timeSpent) {
        const contest = await Contest.findById(contestId);
        if (!contest) {
            throw new Error('Contest not found');
        }

        const now = new Date();
        if (now < contest.startTime) {
            throw new Error('Contest has not started yet');
        }
        if (contest.endTime && now > contest.endTime) {
            throw new Error('Contest has ended');
        }

        // Check max attempts
        if (contest.maxAttempts > 0) {
            const attemptCount = await UserAnswer.countDocuments({ contestId, userId });
            if (attemptCount >= contest.maxAttempts) {
                throw new Error(`You have reached the maximum number of attempts (${contest.maxAttempts})`);
            }
        }

        // Calculate score
        let totalScore = 0;
        const processedAnswers = answers.map((answer, index) => {
            const question = contest.questions[index];
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
        const percentage = contest.totalPoints > 0 ? (totalScore / contest.totalPoints) * 100 : 0;

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
                    reason: `Tham gia cuộc thi "${contest.title}" với điểm số ${percentage.toFixed(0)}%`,
                    relatedId: contestId,
                    relatedType: 'contest',
                    balanceAfter: user.coins
                });
            }
        }

        const userAnswer = new UserAnswer({
            contestId,
            userId,
            answers: processedAnswers,
            totalScore,
            percentage,
            coinsAwarded,
            timeSpent,
            submittedAt: now
        });

        await userAnswer.save();

        // Update participant count only for first attempt
        const isFirstAttempt = await UserAnswer.countDocuments({ contestId, userId }) === 1;
        if (isFirstAttempt) {
            await Contest.findByIdAndUpdate(contestId, {
                $inc: { participantCount: 1 }
            });
        }

        return userAnswer;
    }

    // ===== LEADERBOARD =====
    async getContestLeaderboard(contestId, limit = 50) {
        // Get all answers for this contest, sorted by score desc, time asc
        const allAnswers = await UserAnswer.aggregate([
            { $match: { contestId: new mongoose.Types.ObjectId(contestId) } },
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
        // Get best score per user per contest, then sum for overall
        const leaderboard = await UserAnswer.aggregate([
            {
                $group: {
                    _id: { userId: '$userId', contestId: '$contestId' },
                    bestScore: { $max: '$totalScore' },
                    bestTime: { $min: '$timeSpent' }
                }
            },
            {
                $group: {
                    _id: '$_id.userId',
                    totalScore: { $sum: '$bestScore' },
                    totalContests: { $sum: 1 },
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
                    totalContests: 1,
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
    async getUserAnswer(contestId, userId) {
        const userAnswer = await UserAnswer.findOne({ contestId, userId })
            .populate('contestId')
            .populate('userId', 'name email avatar');

        if (!userAnswer) {
            throw new Error('Answer not found');
        }

        const contest = await Contest.findById(contestId);

        const detailedAnswers = userAnswer.answers.map(answer => {
            const question = contest.questions.find(q =>
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

    async getUserContests(userId) {
        const userAnswers = await UserAnswer.find({ userId })
            .populate('contestId', 'title slug thumbnail totalPoints')
            .sort({ submittedAt: -1 });

        return userAnswers;
    }

    async getUserContestHistory(contestId, userId) {
        const submissions = await UserAnswer.find({ contestId, userId })
            .select('totalScore percentage coinsAwarded timeSpent submittedAt')
            .sort({ submittedAt: -1 })
            .lean();
        return submissions;
    }

    async checkUserAttempts(contestId, userId) {
        const contest = await Contest.findById(contestId);
        if (!contest) {
            throw new Error('Contest not found');
        }

        const attemptCount = await UserAnswer.countDocuments({ contestId, userId });

        return {
            attemptCount,
            maxAttempts: contest.maxAttempts,
            canAttempt: contest.maxAttempts === 0 || attemptCount < contest.maxAttempts,
            remainingAttempts: contest.maxAttempts === 0 ? null : Math.max(0, contest.maxAttempts - attemptCount)
        };
    }
}

module.exports = new DauTruongService();
