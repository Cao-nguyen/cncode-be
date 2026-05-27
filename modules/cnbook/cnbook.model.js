const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Tiêu đề sách là bắt buộc'],
        trim: true,
        maxlength: 200
    },
    slug: {
        type: String,
        unique: true,
        index: true
    },
    description: {
        type: String,
        default: ''
    },
    thumbnail: {
        type: String,
        required: [true, 'Thumbnail là bắt buộc']
    },
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    category: {
        type: String,
        enum: ['grade10', 'grade11', 'grade12', 'other'],
        default: 'other'
    },
    price: {
        type: Number,
        default: 0
    },
    discountPrice: {
        type: Number,
        default: 0
    },
    isFree: {
        type: Boolean,
        default: false
    },
    isPaid: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'approved', 'rejected', 'published'],
        default: 'draft'
    },
    rejectReason: {
        type: String,
        default: ''
    },
    viewCount: {
        type: Number,
        default: 0
    },
    purchaseCount: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        default: 0
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    publishedAt: {
        type: Date
    },
    sections: [{
        title: { type: String, required: true },
        order: { type: Number, default: 0 },
        lessons: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lesson'
        }]
    }]
}, { timestamps: true });

const LessonSchema = new mongoose.Schema({
    bookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        default: ''  
    },
    order: {
        type: Number,
        default: 0
    },
    exercises: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise'
    }]
}, { timestamps: true });

const ExerciseSchema = new mongoose.Schema({
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['multiple_choice', 'true_false', 'short_answer'],
        required: true
    },
    question: {
        type: String,
        required: true
    },
    options: [{
        type: String
    }],
    correctAnswer: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    explanation: {
        type: String,
        default: ''
    },
    points: {
        type: Number,
        default: 1
    },
    order: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const UserBookSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    bookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true,
        index: true
    },
    isPurchased: {
        type: Boolean,
        default: false
    },
    purchasedAt: {
        type: Date
    },
    progress: {
        type: Number,
        default: 0
    },
    lastLessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson'
    },
    notes: [{
        lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
        content: { type: String },
        highlight: { type: String },
        createdAt: { type: Date, default: Date.now }
    }],
    exerciseAnswers: [{
        exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
        answer: { type: mongoose.Schema.Types.Mixed },
        isCorrect: { type: Boolean },
        score: { type: Number },
        answeredAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

BookSchema.pre('save', function (next) {
    if (this.isModified('title') && !this.slug) {
        this.slug = this.title
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '-')
            + '-' + Date.now().toString().slice(-6);
    }
    next();
});

const Book = mongoose.models.Book || mongoose.model('Book', BookSchema);
const Lesson = mongoose.models.Lesson || mongoose.model('Lesson', LessonSchema);
const Exercise = mongoose.models.Exercise || mongoose.model('Exercise', ExerciseSchema);
const UserBook = mongoose.models.UserBook || mongoose.model('UserBook', UserBookSchema);

module.exports = { Book, Lesson, Exercise, UserBook };
