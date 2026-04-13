const { Exercise, Submission } = require("./Exercise.model");
const User = require("../User/User.model");

const getExercises = async (req, res) => {
    try {
        const {
            subject, difficulty, isFree, tag,
            search, page = 1, limit = 12,
        } = req.query;

        const filter = { status: "approved" };
        if (subject) filter.subject = subject;
        if (difficulty) filter.difficulty = difficulty;
        if (isFree !== undefined) filter.isFree = isFree === "true";
        if (tag) filter.tags = { $in: [tag] };
        if (search) filter.title = { $regex: search, $options: "i" };

        const skip = (Number(page) - 1) * Number(limit);

        const [exercises, total] = await Promise.all([
            Exercise.find(filter)
                .select("-questions")
                .populate("author", "name avatar username")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Exercise.countDocuments(filter),
        ]);

        return res.json({
            exercises,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (err) {
        console.error("[getExercises]", err.message);
        return res.status(500).json({ message: "Lỗi server" });
    }
};

const getExerciseById = async (req, res) => {
    try {
        const exercise = await Exercise.findById(req.params.id)
            .populate("author", "name avatar username")
            .lean();

        if (!exercise || exercise.status !== "approved") {
            return res.status(404).json({ message: "Bài tập không tồn tại" });
        }

        const safeQuestions = exercise.questions.map((q) => {
            const safe = { ...q };
            if (safe.multipleChoice) {
                safe.multipleChoice = { options: safe.multipleChoice.options };
            }
            if (safe.multiSelect) {
                safe.multiSelect = { options: safe.multiSelect.options };
            }
            if (safe.shortAnswer) {
                safe.shortAnswer = { hint: safe.shortAnswer.hint };
            }
            if (safe.code) {
                safe.code = {
                    ...safe.code,
                    starterCode: safe.code.starterCode || "",
                    testCases: (safe.code.testCases || []).filter((tc) => !tc.isHidden),
                };
            }
            delete safe.essay;
            delete safe.explanation;
            return safe;
        });

        return res.json({ ...exercise, questions: safeQuestions });
    } catch (err) {
        console.error("[getExerciseById]", err.message);
        return res.status(500).json({ message: "Lỗi server" });
    }
};

const submitExercise = async (req, res) => {
    try {
        const { answers, timeTaken } = req.body;

        const exercise = await Exercise.findById(req.params.id).lean();
        if (!exercise || exercise.status !== "approved") {
            return res.status(404).json({ message: "Bài tập không tồn tại" });
        }

        const user = await User.findById(req.userId).lean();
        const currentCoins = user?.cncoins || 0;

        let totalScore = 0;
        let maxScore = 0;
        const gradedAnswers = [];

        for (let i = 0; i < exercise.questions.length; i++) {
            const q = exercise.questions[i];
            const userAnswer = answers[i] || {};
            maxScore += q.points;

            let isCorrect = false;
            let pointsEarned = 0;
            let testResults = [];

            switch (q.type) {
                case "multiple_choice":
                    isCorrect = userAnswer.selectedIndex === q.multipleChoice.correctIndex;
                    pointsEarned = isCorrect ? q.points : 0;
                    break;

                case "multi_select": {
                    const correct = new Set(q.multiSelect.correctIndexes);
                    const given = new Set(userAnswer.selectedIndexes || []);
                    isCorrect =
                        correct.size === given.size &&
                        [...correct].every((x) => given.has(x));
                    pointsEarned = isCorrect ? q.points : 0;
                    break;
                }

                case "short_answer":
                    isCorrect =
                        String(userAnswer.textAnswer || "").trim().toLowerCase() ===
                        String(q.shortAnswer.correctAnswer).trim().toLowerCase();
                    pointsEarned = isCorrect ? q.points : 0;
                    break;

                case "essay":
                    if (q.essay?.keywords?.length > 0) {
                        const text = (userAnswer.textAnswer || "").toLowerCase();
                        const matched = q.essay.keywords.filter((kw) =>
                            text.includes(kw.toLowerCase())
                        ).length;
                        const ratio = matched / q.essay.keywords.length;
                        pointsEarned = Math.round(q.points * ratio);
                        isCorrect = ratio >= 0.8;
                    } else {
                        isCorrect = (userAnswer.textAnswer || "").trim().length > 20;
                        pointsEarned = isCorrect ? q.points : 0;
                    }
                    break;

                case "code":
                    isCorrect = (userAnswer.code || "").trim().length > 10;
                    pointsEarned = isCorrect ? q.points : 0;
                    testResults = (q.code?.testCases || []).map((tc) => ({
                        input: tc.input,
                        expectedOutput: tc.expectedOutput,
                        actualOutput: "N/A",
                        passed: false,
                    }));
                    break;
            }

            totalScore += pointsEarned;
            gradedAnswers.push({
                questionIndex: i,
                selectedIndex: userAnswer.selectedIndex ?? null,
                selectedIndexes: userAnswer.selectedIndexes || [],
                textAnswer: userAnswer.textAnswer || null,
                code: userAnswer.code || null,
                isCorrect,
                pointsEarned,
                testResults,
            });
        }

        const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

        const submission = await Submission.create({
            exercise: exercise._id,
            user: req.userId,
            answers: gradedAnswers,
            totalScore,
            maxScore,
            percentage,
            timeTaken: timeTaken || 0,
        });

        const totalAttempts = (exercise.totalAttempts || 0) + 1;
        const totalCompletions = (exercise.totalCompletions || 0) + (percentage >= 50 ? 1 : 0);
        const newAverageScore = ((exercise.averageScore || 0) * (exercise.totalAttempts || 0) + percentage) / totalAttempts;

        await Exercise.findByIdAndUpdate(exercise._id, {
            $inc: { totalAttempts: 1 },
            $set: {
                averageScore: Math.round(newAverageScore),
                totalCompletions,
            },
        });

        const questionsWithAnswers = exercise.questions.map((q) => ({
            ...q,
            correctAnswer: (() => {
                if (q.type === "multiple_choice") return q.multipleChoice.correctIndex;
                if (q.type === "multi_select") return q.multiSelect.correctIndexes;
                if (q.type === "short_answer") return q.shortAnswer.correctAnswer;
                if (q.type === "essay") return q.essay?.sampleAnswer;
                return null;
            })(),
        }));

        return res.json({
            submissionId: submission._id,
            totalScore,
            maxScore,
            percentage,
            timeTaken,
            answers: gradedAnswers,
            questions: questionsWithAnswers,
            isSpinnable: exercise.isSpinnable && percentage >= 50,
            spinReward: exercise.spinReward || 50,
            currentCoins,
        });
    } catch (err) {
        console.error("[submitExercise]", err.message);
        return res.status(500).json({ message: "Lỗi khi chấm bài" });
    }
};

const spinWheel = async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.submissionId);

        if (!submission) {
            return res.status(404).json({ message: "Không tìm thấy kết quả" });
        }
        if (String(submission.user) !== String(req.userId)) {
            return res.status(403).json({ message: "Không có quyền" });
        }
        if (submission.spinUsed) {
            return res.status(400).json({ message: "Đã sử dụng vòng quay" });
        }

        const exercise = await Exercise.findById(submission.exercise).lean();
        if (!exercise?.isSpinnable || submission.percentage < 50) {
            return res.status(400).json({ message: "Không đủ điều kiện quay" });
        }

        const maxReward = exercise.spinReward || 100;
        const segments = [0, 10, 20, 30, 50, maxReward, 0, 10, 20];
        const randomIndex = Math.floor(Math.random() * segments.length);
        const reward = segments[randomIndex];

        const bonusMultiplier = submission.percentage >= 90 ? 1.5 : 1;
        const finalReward = Math.round(reward * bonusMultiplier);

        submission.spinUsed = true;
        submission.spinResult = finalReward;
        await submission.save();

        let newCoins = 0;
        if (finalReward > 0) {
            const updatedUser = await User.findByIdAndUpdate(
                req.userId,
                { $inc: { cncoins: finalReward } },
                { new: true }
            );
            newCoins = updatedUser.cncoins;
        }

        return res.json({
            reward: finalReward,
            newCoins,
            segmentIndex: randomIndex,
            segments,
        });
    } catch (err) {
        console.error("[spinWheel]", err.message);
        return res.status(500).json({ message: "Lỗi server" });
    }
};

const createExercise = async (req, res) => {
    try {
        const {
            title, description, subject, difficulty,
            tags, isFree, costCoins, questions,
            timeLimit, shuffleQuestions, isSpinnable, spinReward,
        } = req.body;

        if (!title || !subject || !questions?.length) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
        }

        const exercise = await Exercise.create({
            title,
            description,
            subject,
            difficulty: difficulty || "easy",
            tags: tags || [],
            isFree: isFree ?? true,
            costCoins: costCoins || 0,
            questions,
            timeLimit: timeLimit || null,
            shuffleQuestions: shuffleQuestions || false,
            isSpinnable: isSpinnable || false,
            spinReward: spinReward || 0,
            author: req.userId,
            status: req.userRole === "admin" ? "approved" : "pending",
        });

        return res.status(201).json({
            message:
                req.userRole === "admin"
                    ? "Tạo bài tập thành công"
                    : "Bài tập đã gửi, chờ duyệt",
            exercise,
        });
    } catch (err) {
        console.error("[createExercise]", err.message);
        return res.status(500).json({ message: "Lỗi tạo bài tập" });
    }
};

const updateExerciseStatus = async (req, res) => {
    try {
        const { status, rejectedReason } = req.body;
        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Trạng thái không hợp lệ" });
        }

        const exercise = await Exercise.findByIdAndUpdate(
            req.params.id,
            { status, rejectedReason: rejectedReason || null },
            { new: true }
        );

        if (!exercise) return res.status(404).json({ message: "Không tìm thấy" });

        return res.json({ message: "Cập nhật thành công", exercise });
    } catch (err) {
        return res.status(500).json({ message: "Lỗi server" });
    }
};

const getMySubmissions = async (req, res) => {
    try {
        const submissions = await Submission.find({ user: req.userId })
            .populate("exercise", "title subject difficulty thumbnail")
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        return res.json(submissions);
    } catch (err) {
        return res.status(500).json({ message: "Lỗi server" });
    }
};

module.exports = {
    getExercises,
    getExerciseById,
    submitExercise,
    spinWheel,
    createExercise,
    updateExerciseStatus,
    getMySubmissions,
};