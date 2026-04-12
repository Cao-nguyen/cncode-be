const mongoose = require("mongoose");

// ── Sub-schemas cho từng dạng câu hỏi ────────────────────────────────────────

const multipleChoiceSchema = new mongoose.Schema({
    options: [{ type: String, required: true }], // 4 phương án
    correctIndex: { type: Number, required: true }, // index 0-3
}, { _id: false });

const multiSelectSchema = new mongoose.Schema({
    options: [{ type: String, required: true }],
    correctIndexes: [{ type: Number, required: true }], // nhiều đáp án đúng
}, { _id: false });

const shortAnswerSchema = new mongoose.Schema({
    correctAnswer: { type: String, required: true }, // đúng 1 giá trị (4 chữ số)
    hint: { type: String, default: null },
}, { _id: false });

const essaySchema = new mongoose.Schema({
    sampleAnswer: { type: String, default: null }, // đáp án gợi ý
    keywords: [{ type: String }], // từ khoá chấm điểm tự động
}, { _id: false });

const codeSchema = new mongoose.Schema({
    language: {
        type: String,
        enum: ["javascript", "python", "cpp", "java", "c"],
        default: "javascript",
    },
    starterCode: { type: String, default: "" }, // code khung cho user
    testCases: [
        {
            input: { type: String },
            expectedOutput: { type: String },
            isHidden: { type: Boolean, default: false },
        },
    ],
    timeLimit: { type: Number, default: 2000 }, // ms
    memoryLimit: { type: Number, default: 128 }, // MB
}, { _id: false });

// ── Question schema ────────────────────────────────────────────────────────────
const questionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["multiple_choice", "multi_select", "short_answer", "essay", "code"],
        required: true,
    },
    content: { type: String, required: true }, // nội dung câu hỏi (Markdown)
    points: { type: Number, default: 10 },
    explanation: { type: String, default: null }, // giải thích đáp án

    // Chỉ 1 trong 5 field dưới được dùng tùy type
    multipleChoice: { type: multipleChoiceSchema, default: null },
    multiSelect: { type: multiSelectSchema, default: null },
    shortAnswer: { type: shortAnswerSchema, default: null },
    essay: { type: essaySchema, default: null },
    code: { type: codeSchema, default: null },
});

// ── Exercise schema ────────────────────────────────────────────────────────────
const exerciseSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true },
        thumbnail: { type: String, default: null },

        subject: {
            type: String,
            enum: ["programming", "ai", "office", "highschool", "other"],
            required: true,
        },
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            default: "easy",
        },
        tags: [{ type: String, trim: true }],

        // Phân loại miễn phí / trả phí
        isFree: { type: Boolean, default: true },
        // Số CNcoins cần để mở (khi isFree = false)
        costCoins: { type: Number, default: 0 },

        questions: [questionSchema],

        // Cài đặt làm bài
        timeLimit: { type: Number, default: null }, // phút, null = không giới hạn
        shuffleQuestions: { type: Boolean, default: false },

        // Tác giả
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Trạng thái duyệt
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        rejectedReason: { type: String, default: null },

        // Thống kê
        totalAttempts: { type: Number, default: 0 },
        totalCompletions: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },

        // Vòng quay: bài nào cho phép quay
        isSpinnable: { type: Boolean, default: false },
        spinReward: { type: Number, default: 0 }, // CNcoins tối đa
    },
    { timestamps: true }
);

// Indexes
exerciseSchema.index({ subject: 1, difficulty: 1 });
exerciseSchema.index({ status: 1 });
exerciseSchema.index({ author: 1 });
exerciseSchema.index({ tags: 1 });
exerciseSchema.index({ isFree: 1 });

// ── Submission schema (kết quả làm bài) ──────────────────────────────────────
const submissionSchema = new mongoose.Schema(
    {
        exercise: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Exercise",
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        answers: [
            {
                questionIndex: { type: Number },
                // Lưu đáp án theo type
                selectedIndex: { type: Number, default: null },         // multiple_choice
                selectedIndexes: [{ type: Number }],                    // multi_select
                textAnswer: { type: String, default: null },            // short_answer / essay
                code: { type: String, default: null },                  // code
                // Kết quả chấm
                isCorrect: { type: Boolean, default: false },
                pointsEarned: { type: Number, default: 0 },
                testResults: [                                           // code
                    {
                        input: String,
                        expectedOutput: String,
                        actualOutput: String,
                        passed: Boolean,
                    },
                ],
            },
        ],
        totalScore: { type: Number, default: 0 },
        maxScore: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        timeTaken: { type: Number, default: 0 }, // giây
        completedAt: { type: Date, default: Date.now },
        // Vòng quay đã dùng chưa
        spinUsed: { type: Boolean, default: false },
        spinResult: { type: Number, default: null }, // CNcoins nhận được
    },
    { timestamps: true }
);

submissionSchema.index({ user: 1, exercise: 1 });
submissionSchema.index({ exercise: 1 });

const Exercise = mongoose.model("Exercise", exerciseSchema);
const Submission = mongoose.model("Submission", submissionSchema);

module.exports = { Exercise, Submission };