const { Exercise, Submission } = require("./Exercise.model");
const User = require("../User/User.model");

// ═══════════════════════════════════════════════════════════════════
//  LIST - GET /api/exercises
// ═══════════════════════════════════════════════════════════════════
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
                .select("-questions")          // Danh sách không cần câu hỏi
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

// ═══════════════════════════════════════════════════════════════════
//  DETAIL - GET /api/exercises/:id
// ═══════════════════════════════════════════════════════════════════
const getExerciseById = async (req, res) => {
    try {
        const exercise = await Exercise.findById(req.params.id)
            .populate("author", "name avatar username")
            .lean();

        if (!exercise || exercise.status !== "approved") {
            return res.status(404).json({ message: "Bài tập không tồn tại" });
        }

        // Ẩn đáp án trong câu hỏi khi trả về detail (chỉ trả khi submit)
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
                // Ẩn hidden test cases
                safe.code = {
                    ...safe.code,
                    testCases: safe.code.testCases.filter((tc) => !tc.isHidden),
                };
            }
            // essay và safe.explanation → ẩn hết
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

// ═══════════════════════════════════════════════════════════════════
//  SUBMIT - POST /api/exercises/:id/submit
// ═══════════════════════════════════════════════════════════════════
const submitExercise = async (req, res) => {
    try {
        const { answers, timeTaken } = req.body;

        const exercise = await Exercise.findById(req.params.id).lean();
        if (!exercise || exercise.status !== "approved") {
            return res.status(404).json({ message: "Bài tập không tồn tại" });
        }

        // Chấm điểm
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
                    // Tự luận: chấm theo keyword (partial credit)
                    if (q.essay?.keywords?.length > 0) {
                        const text = (userAnswer.textAnswer || "").toLowerCase();
                        const matched = q.essay.keywords.filter((kw) =>
                            text.includes(kw.toLowerCase())
                        ).length;
                        const ratio = matched / q.essay.keywords.length;
                        pointsEarned = Math.round(q.points * ratio);
                        isCorrect = ratio >= 0.8;
                    } else {
                        // Không có keywords → cho điểm tối đa nếu có nội dung
                        isCorrect = (userAnswer.textAnswer || "").trim().length > 20;
                        pointsEarned = isCorrect ? q.points : 0;
                    }
                    break;

                case "code":
                    // Placeholder: chạy test cases (cần sandbox thực tế)
                    // Hiện tại: kiểm tra code không rỗng
                    isCorrect = (userAnswer.code || "").trim().length > 10;
                    pointsEarned = isCorrect ? q.points : 0;
                    testResults = (q.code?.testCases || []).map((tc) => ({
                        input: tc.input,
                        expectedOutput: tc.expectedOutput,
                        actualOutput: "N/A (sandbox chưa kết nối)",
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

        // Lưu submission
        const submission = await Submission.create({
            exercise: exercise._id,
            user: req.userId,
            answers: gradedAnswers,
            totalScore,
            maxScore,
            percentage,
            timeTaken: timeTaken || 0,
        });

        // Cập nhật thống kê exercise
        await Exercise.findByIdAndUpdate(exercise._id, {
            $inc: { totalAttempts: 1, totalCompletions: 1 },
            $set: {
                averageScore: percentage, // simplified, dùng $avg trong production
            },
        });

        // Trả về kết quả kèm đáp án đúng
        const questionsWithAnswers = exercise.questions.map((q) => ({
            ...q,
            // Trả đáp án đúng sau khi nộp
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
            spinReward: exercise.spinReward,
        });
    } catch (err) {
        console.error("[submitExercise]", err.message);
        return res.status(500).json({ message: "Lỗi khi chấm bài" });
    }
};

// ═══════════════════════════════════════════════════════════════════
//  SPIN - POST /api/exercises/submissions/:submissionId/spin
// ═══════════════════════════════════════════════════════════════════
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

        // Tính phần thưởng dựa trên điểm số + may mắn
        const maxReward = exercise.spinReward || 100;
        const segments = [0, 10, 20, 30, 50, maxReward, 0, 10, 20];
        const randomIndex = Math.floor(Math.random() * segments.length);
        const reward = segments[randomIndex];

        // Cộng bonus nếu điểm cao
        const bonusMultiplier = submission.percentage >= 90 ? 1.5 : 1;
        const finalReward = Math.round(reward * bonusMultiplier);

        // Cập nhật submission + user coins
        submission.spinUsed = true;
        submission.spinResult = finalReward;
        await submission.save();

        if (finalReward > 0) {
            await User.findByIdAndUpdate(req.userId, {
                $inc: { cncoins: finalReward },
            });
        }

        return res.json({
            segmentIndex: randomIndex,
            reward: finalReward,
            segments,
        });
    } catch (err) {
        console.error("[spinWheel]", err.message);
        return res.status(500).json({ message: "Lỗi server" });
    }
};

// ═══════════════════════════════════════════════════════════════════
//  CREATE - POST /api/exercises (user/admin)
// ═══════════════════════════════════════════════════════════════════
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
            // Admin → duyệt ngay; user → pending
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

// ═══════════════════════════════════════════════════════════════════
//  ADMIN: Approve/Reject - PATCH /api/exercises/:id/status
// ═══════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════
//  MY SUBMISSIONS - GET /api/exercises/my-submissions
// ═══════════════════════════════════════════════════════════════════
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