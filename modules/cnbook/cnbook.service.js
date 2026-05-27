const { Book, Lesson, Exercise, UserBook } = require('./cnbook.model');

class CNBookService {
    
    async createBook(userId, data, userRole) {
        const status = userRole === 'admin' ? 'approved' : 'pending';

        const book = new Book({
            ...data,
            authorId: userId,
            status,
            slug: data.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-6)
        });

        if (data.isFree) {
            book.isFree = true;
            book.isPaid = false;
            book.price = 0;
            book.discountPrice = 0;
        } else if (data.discountPrice && data.discountPrice < data.price) {
            book.isPaid = true;
            book.isFree = false;
        }

        await book.save();
        return book;
    }

    async updateBook(bookId, userId, data, userRole) {
        const query = userRole === 'admin' ? { _id: bookId } : { _id: bookId, authorId: userId };
        const book = await Book.findOne(query);
        if (!book) throw new Error('Không tìm thấy sách hoặc bạn không có quyền');

        Object.assign(book, data);

        if (data.isFree) {
            book.isFree = true;
            book.isPaid = false;
            book.price = 0;
            book.discountPrice = 0;
        } else if (data.discountPrice && data.discountPrice < data.price) {
            book.isPaid = true;
            book.isFree = false;
        }

        await book.save();
        return book;
    }

    async addSection(bookId, userId, sectionData, userRole) {
        const query = userRole === 'admin' ? { _id: bookId } : { _id: bookId, authorId: userId };
        const book = await Book.findOne(query);
        if (!book) throw new Error('Không tìm thấy sách hoặc bạn không có quyền');

        book.sections.push({
            title: sectionData.title,
            order: sectionData.order || book.sections.length
        });
        await book.save();
        return book;
    }

    async updateSection(bookId, sectionId, userId, sectionData, userRole) {
        const query = userRole === 'admin' ? { _id: bookId } : { _id: bookId, authorId: userId };
        const book = await Book.findOne(query);
        if (!book) throw new Error('Không tìm thấy sách hoặc bạn không có quyền');

        const section = book.sections.id(sectionId);
        if (!section) throw new Error('Không tìm thấy phần');

        if (sectionData.title !== undefined) section.title = sectionData.title;
        if (sectionData.order !== undefined) section.order = sectionData.order;

        await book.save();
        return book;
    }

    async deleteSection(bookId, sectionId, userId, userRole) {
        const query = userRole === 'admin' ? { _id: bookId } : { _id: bookId, authorId: userId };
        const book = await Book.findOne(query);
        if (!book) throw new Error('Không tìm thấy sách hoặc bạn không có quyền');

        book.sections = book.sections.filter(s => s._id.toString() !== sectionId);
        await book.save();
        return book;
    }

    async addLesson(bookId, sectionId, userId, lessonData, userRole) {
        const query = userRole === 'admin' ? { _id: bookId } : { _id: bookId, authorId: userId };
        const book = await Book.findOne(query);
        if (!book) throw new Error('Không tìm thấy sách hoặc bạn không có quyền');

        const section = book.sections.id(sectionId);
        if (!section) throw new Error('Không tìm thấy phần');

        const lesson = new Lesson({
            bookId,
            title: lessonData.title,
            content: lessonData.content || '',  
            order: lessonData.order || 0
        });
        await lesson.save();

        section.lessons.push(lesson._id);
        await book.save();

        return lesson;
    }

    async updateLesson(lessonId, userId, lessonData, userRole) {
        const lesson = await Lesson.findById(lessonId).populate('bookId');
        if (!lesson) throw new Error('Không tìm thấy bài học');

        const book = lesson.bookId;
        const query = userRole === 'admin' ? true : book.authorId.toString() === userId;
        if (!query) throw new Error('Bạn không có quyền');

        if (lessonData.title !== undefined) lesson.title = lessonData.title;
        if (lessonData.content !== undefined) lesson.content = lessonData.content;
        if (lessonData.order !== undefined) lesson.order = lessonData.order;

        await lesson.save();
        return lesson;
    }

    async deleteLesson(lessonId, userId, userRole) {
        const lesson = await Lesson.findById(lessonId).populate('bookId');
        if (!lesson) throw new Error('Không tìm thấy bài học');

        const book = lesson.bookId;
        const query = userRole === 'admin' ? true : book.authorId.toString() === userId;
        if (!query) throw new Error('Bạn không có quyền');

        await Exercise.deleteMany({ lessonId });
        await lesson.deleteOne();

        for (const section of book.sections) {
            if (section.lessons.includes(lessonId)) {
                section.lessons = section.lessons.filter(id => id.toString() !== lessonId);
                await book.save();
                break;
            }
        }

        return true;
    }

    async addExercise(lessonId, userId, exerciseData, userRole) {
        const lesson = await Lesson.findById(lessonId).populate('bookId');
        if (!lesson) throw new Error('Không tìm thấy bài học');

        const book = lesson.bookId;
        const query = userRole === 'admin' ? true : book.authorId.toString() === userId;
        if (!query) throw new Error('Bạn không có quyền');

        const exercise = new Exercise({
            lessonId,
            ...exerciseData
        });
        await exercise.save();

        lesson.exercises.push(exercise._id);
        await lesson.save();

        return exercise;
    }

    async updateExercise(exerciseId, userId, exerciseData, userRole) {
        const exercise = await Exercise.findById(exerciseId).populate({
            path: 'lessonId',
            populate: { path: 'bookId' }
        });
        if (!exercise) throw new Error('Không tìm thấy bài tập');

        const book = exercise.lessonId.bookId;
        const query = userRole === 'admin' ? true : book.authorId.toString() === userId;
        if (!query) throw new Error('Bạn không có quyền');

        Object.assign(exercise, exerciseData);
        await exercise.save();

        return exercise;
    }

    async deleteExercise(exerciseId, userId, userRole) {
        const exercise = await Exercise.findById(exerciseId).populate({
            path: 'lessonId',
            populate: { path: 'bookId' }
        });
        if (!exercise) throw new Error('Không tìm thấy bài tập');

        const book = exercise.lessonId.bookId;
        const query = userRole === 'admin' ? true : book.authorId.toString() === userId;
        if (!query) throw new Error('Bạn không có quyền');

        const lesson = await Lesson.findById(exercise.lessonId);
        lesson.exercises = lesson.exercises.filter(id => id.toString() !== exerciseId);
        await lesson.save();

        await exercise.deleteOne();
        return true;
    }

    async getBooks({ page = 1, limit = 12, category = 'all', search = '', sort = 'latest', status = 'published' }) {
        const query = { status };
        if (category !== 'all') query.category = category;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        let sortOption = {};
        switch (sort) {
            case 'latest': sortOption = { createdAt: -1 }; break;
            case 'oldest': sortOption = { createdAt: 1 }; break;
            case 'popular': sortOption = { purchaseCount: -1 }; break;
            case 'rating': sortOption = { rating: -1 }; break;
            case 'price_asc': sortOption = { price: 1 }; break;
            case 'price_desc': sortOption = { price: -1 }; break;
            default: sortOption = { createdAt: -1 };
        }

        const skip = (page - 1) * limit;
        const [books, total] = await Promise.all([
            Book.find(query)
                .populate('authorId', 'fullName email avatar')
                .sort(sortOption)
                .skip(skip)
                .limit(limit)
                .lean(),
            Book.countDocuments(query)
        ]);

        books.forEach(book => {
            if (book.isFree) {
                book.finalPrice = 0;
            } else if (book.discountPrice && book.discountPrice < book.price) {
                book.finalPrice = book.discountPrice;
            } else {
                book.finalPrice = book.price;
            }
            book.discountPercent = book.price > 0 ? Math.round(((book.price - book.finalPrice) / book.price) * 100) : 0;
        });

        return { books, total, page, totalPages: Math.ceil(total / limit) };
    }

    async getBookBySlug(slug) {
        await Book.findOneAndUpdate({ slug }, { $inc: { viewCount: 1 } });
        const book = await Book.findOne({ slug })
            .populate('authorId', 'fullName email avatar')
            .populate({
                path: 'sections',
                populate: {
                    path: 'lessons',
                    populate: {
                        path: 'exercises'
                    }
                }
            });

        if (!book) throw new Error('Không tìm thấy sách');

        if (book.isFree) {
            book.finalPrice = 0;
        } else if (book.discountPrice && book.discountPrice < book.price) {
            book.finalPrice = book.discountPrice;
        } else {
            book.finalPrice = book.price;
        }
        book.discountPercent = book.price > 0 ? Math.round(((book.price - book.finalPrice) / book.price) * 100) : 0;

        return book;
    }

    async getBookById(bookId) {
        const book = await Book.findById(bookId)
            .populate('authorId', 'fullName email avatar')
            .populate({
                path: 'sections',
                populate: {
                    path: 'lessons',
                    populate: {
                        path: 'exercises'
                    }
                }
            });
        if (!book) throw new Error('Không tìm thấy sách');
        return book;
    }

    async getBookById(bookId) {
        const book = await Book.findById(bookId)
            .populate('authorId', 'fullName email avatar')
            .populate({
                path: 'sections',
                populate: {
                    path: 'lessons',
                    populate: {
                        path: 'exercises'
                    }
                }
            });
        if (!book) throw new Error('Không tìm thấy sách');

        if (book.isFree) {
            book.finalPrice = 0;
        } else if (book.discountPrice && book.discountPrice < book.price) {
            book.finalPrice = book.discountPrice;
        } else {
            book.finalPrice = book.price;
        }
        book.discountPercent = book.price > 0 ? Math.round(((book.price - book.finalPrice) / book.price) * 100) : 0;

        return book;
    }

    async getUserBooks(userId, { page = 1, limit = 10, status = 'all', search = '' }) {
        console.log('📚 [SERVICE] getUserBooks called');
        console.log('📚 userId:', userId);

        const query = { authorId: userId };
        if (status !== 'all') query.status = status;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        console.log('📚 Query:', JSON.stringify(query));

        const skip = (page - 1) * limit;
        const [books, total] = await Promise.all([
            Book.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Book.countDocuments(query)
        ]);

        console.log('📚 Found books:', books.length);

        books.forEach(book => {
            if (book.isFree) {
                book.finalPrice = 0;
            } else if (book.discountPrice && book.discountPrice < book.price) {
                book.finalPrice = book.discountPrice;
            } else {
                book.finalPrice = book.price;
            }
            book.discountPercent = book.price > 0 ? Math.round(((book.price - book.finalPrice) / book.price) * 100) : 0;
        });

        return { books, total, page, totalPages: Math.ceil(total / limit) };
    }

    async getAdminBooks({ page = 1, limit = 10, status = 'all', search = '', category = 'all' }) {
        const query = {};
        if (status !== 'all') query.status = status;
        if (category !== 'all') query.category = category;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;
        const [books, total] = await Promise.all([
            Book.find(query)
                .populate('authorId', 'fullName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Book.countDocuments(query)
        ]);

        return { books, total, page, totalPages: Math.ceil(total / limit) };
    }

    async approveBook(bookId, status, rejectReason = '') {
        const book = await Book.findById(bookId);
        if (!book) throw new Error('Không tìm thấy sách');

        book.status = status;
        if (rejectReason) book.rejectReason = rejectReason;
        if (status === 'published') book.publishedAt = new Date();

        await book.save();
        return book;
    }

    async deleteBook(bookId, userId, userRole) {
        const query = userRole === 'admin' ? { _id: bookId } : { _id: bookId, authorId: userId };
        const book = await Book.findOne(query);
        if (!book) throw new Error('Không tìm thấy sách hoặc bạn không có quyền');

        const lessons = await Lesson.find({ bookId });
        for (const lesson of lessons) {
            await Exercise.deleteMany({ lessonId: lesson._id });
        }
        await Lesson.deleteMany({ bookId });
        await UserBook.deleteMany({ bookId });
        await book.deleteOne();

        return true;
    }

    async getStatistics() {
        const [total, published, pending, draft, totalPurchases] = await Promise.all([
            Book.countDocuments(),
            Book.countDocuments({ status: 'published' }),
            Book.countDocuments({ status: 'pending' }),
            Book.countDocuments({ status: 'draft' }),
            Book.aggregate([{ $group: { _id: null, total: { $sum: '$purchaseCount' } } }])
        ]);

        const categoryStats = await Book.aggregate([
            { $match: { status: 'published' } },
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        return { total, published, pending, draft, totalPurchases: totalPurchases[0]?.total || 0, categoryStats };
    }

    async purchaseBook(userId, bookId, useCoins = false) {
        const book = await Book.findById(bookId);
        if (!book) throw new Error('Không tìm thấy sách');
        if (book.isFree) throw new Error('Sách này miễn phí, không cần mua');

        const existing = await UserBook.findOne({ userId, bookId });
        if (existing && existing.isPurchased) throw new Error('Bạn đã mua sách này rồi');

        let user = await User.findById(userId);
        const finalPrice = book.discountPrice && book.discountPrice < book.price ? book.discountPrice : book.price;

        if (useCoins) {
            if (user.coins < finalPrice) throw new Error(`Không đủ xu! Cần ${finalPrice} xu`);
            user.coins -= finalPrice;
            await user.save();
        } else {
            
        }

        const userBook = await UserBook.findOneAndUpdate(
            { userId, bookId },
            { isPurchased: true, purchasedAt: new Date() },
            { upsert: true, new: true }
        );

        book.purchaseCount += 1;
        await book.save();

        return userBook;
    }

    async getUserBook(userId, bookId) {
        let userBook = await UserBook.findOne({ userId, bookId });
        if (!userBook) {
            const book = await Book.findById(bookId);
            if (book.isFree) {
                userBook = await UserBook.create({ userId, bookId, isPurchased: true, purchasedAt: new Date() });
            } else {
                throw new Error('Bạn chưa mua sách này');
            }
        }

        const book = await Book.findById(bookId)
            .populate({
                path: 'sections',
                populate: {
                    path: 'lessons',
                    populate: {
                        path: 'exercises'
                    }
                }
            });

        return { book, userBook };
    }

    async saveNote(userId, bookId, lessonId, content, highlight) {
        const userBook = await UserBook.findOne({ userId, bookId });
        if (!userBook) throw new Error('Bạn chưa có quyền truy cập sách này');

        userBook.notes.push({ lessonId, content, highlight });
        await userBook.save();

        return userBook.notes[userBook.notes.length - 1];
    }

    async saveExerciseAnswer(userId, bookId, exerciseId, answer) {
        const userBook = await UserBook.findOne({ userId, bookId });
        if (!userBook) throw new Error('Bạn chưa có quyền truy cập sách này');

        const exercise = await Exercise.findById(exerciseId);
        if (!exercise) throw new Error('Không tìm thấy bài tập');

        let isCorrect = false;
        let score = 0;

        if (exercise.type === 'multiple_choice') {
            isCorrect = answer === exercise.correctAnswer;
            score = isCorrect ? exercise.points : 0;
        } else if (exercise.type === 'true_false') {
            isCorrect = answer === exercise.correctAnswer;
            score = isCorrect ? exercise.points : 0;
        } else if (exercise.type === 'short_answer') {
            const userAnswer = String(answer).trim().toLowerCase();
            const correctAnswer = String(exercise.correctAnswer).trim().toLowerCase();
            isCorrect = userAnswer === correctAnswer;
            score = isCorrect ? exercise.points : 0;
        }

        const existingIndex = userBook.exerciseAnswers.findIndex(e => e.exerciseId.toString() === exerciseId);
        if (existingIndex !== -1) {
            userBook.exerciseAnswers[existingIndex] = { exerciseId, answer, isCorrect, score, answeredAt: new Date() };
        } else {
            userBook.exerciseAnswers.push({ exerciseId, answer, isCorrect, score, answeredAt: new Date() });
        }

        await userBook.save();

        return { isCorrect, score, correctAnswer: exercise.correctAnswer };
    }

    async updateProgress(userId, bookId, lessonId, progress) {
        const userBook = await UserBook.findOne({ userId, bookId });
        if (!userBook) throw new Error('Bạn chưa có quyền truy cập sách này');

        userBook.progress = progress;
        userBook.lastLessonId = lessonId;
        await userBook.save();

        return userBook;
    }

    async getUserProgress(userId, bookId) {
        const userBook = await UserBook.findOne({ userId, bookId });
        if (!userBook) return { progress: 0, lastLessonId: null, notes: [], exerciseAnswers: [] };

        return {
            progress: userBook.progress,
            lastLessonId: userBook.lastLessonId,
            notes: userBook.notes,
            exerciseAnswers: userBook.exerciseAnswers
        };
    }
}

module.exports = new CNBookService();
