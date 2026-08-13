const Course = require('./khoahoc.model');
const Chapter = require('../chuong/chuong.model');
const Lesson = require('../baihoc/baihoc.model');
const Enrollment = require('../enrollment/enrollment.model');
const Progress = require('../tiendo/tiendo.model');
const CourseReview = require('./courseReview.model');

class CourseService {
    // ===== PUBLIC =====
    async getPublicList(query = {}) {
        const { type, sort, page = 1, limit = 12, search } = query;
        const filter = { status: 'approved', isHidden: false };

        if (type) filter.type = type;
        if (search) filter.title = { $regex: search, $options: 'i' };

        let sortObj = { createdAt: -1 }; // default newest
        if (sort === 'price-asc') sortObj = { discountPrice: 1, price: 1 };
        else if (sort === 'price-desc') sortObj = { discountPrice: -1, price: -1 };

        const skip = (page - 1) * limit;
        const [courses, total] = await Promise.all([
            Course.find(filter)
                .populate('teacherId', 'fullName avatar')
                .sort(sortObj)
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Course.countDocuments(filter)
        ]);

        const courseIds = courses.map(course => course._id);
        const enrollmentCounts = await Enrollment.aggregate([
            {
                $match: {
                    courseId: { $in: courseIds },
                    paymentStatus: 'completed'
                }
            },
            {
                $group: {
                    _id: '$courseId',
                    count: { $sum: 1 }
                }
            }
        ]);
        const countMap = enrollmentCounts.reduce((acc, item) => {
            acc[item._id.toString()] = item.count;
            return acc;
        }, {});
        const coursesWithEnrollCount = courses.map(course => ({
            ...course,
            enrollCount: countMap[course._id.toString()] || 0
        }));

        return { courses: coursesWithEnrollCount, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
    }

    async getBySlug(slug) {
        const course = await Course.findOne({ slug, status: 'approved' })
            .populate('teacherId', 'fullName avatar bio')
            .lean();
        if (!course) throw new Error('Course not found');

        const chapters = await Chapter.find({ courseId: course._id }).sort({ order: 1 });
        const lessons = await Lesson.find({ courseId: course._id }).sort({ order: 1 });

        // Group lessons by chapter
        const enrollCount = await Enrollment.countDocuments({
            courseId: course._id,
            paymentStatus: 'completed'
        });
        const courseWithEnrollCount = {
            ...course,
            enrollCount
        };

        const chaptersWithLessons = chapters.map(ch => ({
            ...ch.toObject(),
            lessons: lessons.filter(l => l.chapterId.toString() === ch._id.toString())
                .map(l => ({
                    _id: l._id,
                    title: l.title,
                    order: l.order,
                    type: l.type,
                    duration: l.duration,
                    isPreview: l.isPreview,
                }))
        }));

        const recentEnrollees = await this.getRecentEnrollees(course._id);

        return { course: courseWithEnrollCount, chapters: chaptersWithLessons, recentEnrollees };
    }

    async getRecentEnrollees(courseId, limit = 12) {
        const enrollments = await Enrollment.find({
            courseId,
            paymentStatus: 'completed',
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'fullName avatar')
            .lean();

        return enrollments
            .filter((item) => item.userId)
            .map((item) => ({
                _id: item.userId._id,
                fullName: item.userId.fullName || 'Học viên',
                avatar: item.userId.avatar || null,
            }));
    }

    async assertCanReviewCourse(courseId, userId) {
        const course = await Course.findById(courseId).select('teacherId status');
        if (!course || course.status !== 'approved') {
            return { ok: false, message: 'Khóa học không tồn tại' };
        }
        if (String(course.teacherId) === String(userId)) {
            return { ok: false, message: 'Giảng viên không thể đánh giá khóa học của mình' };
        }
        const enrollment = await Enrollment.findOne({
            userId,
            courseId,
            paymentStatus: 'completed',
        });
        if (!enrollment) {
            return { ok: false, message: 'Chỉ học viên đã tham gia mới được đánh giá' };
        }
        return { ok: true, course };
    }

    async getCourseReviews(courseId, { page = 1, limit = 10 } = {}) {
        const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
        const [reviews, total, stats] = await Promise.all([
            CourseReview.find({ courseId })
                .populate('userId', 'fullName avatar')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            CourseReview.countDocuments({ courseId }),
            CourseReview.getStatsForCourse(courseId),
        ]);

        return {
            success: true,
            data: reviews.map((review) => ({
                _id: review._id,
                rating: review.rating,
                content: review.content,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt,
                user: review.userId
                    ? {
                        _id: review.userId._id,
                        fullName: review.userId.fullName,
                        avatar: review.userId.avatar,
                    }
                    : null,
            })),
            stats,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)) || 1,
            },
        };
    }

    async getMyCourseReview(courseId, userId) {
        if (!userId) {
            return { success: true, data: { canReview: false, myReview: null } };
        }

        const [access, myReview] = await Promise.all([
            this.assertCanReviewCourse(courseId, userId).catch(() => ({ ok: false })),
             CourseReview.findOne({ courseId, userId }).lean(),
        ]);

        return {
            success: true,
            data: {
                canReview: !!access.ok && !myReview,
                myReview: myReview
                    ? {
                        _id: myReview._id,
                        rating: myReview.rating,
                        content: myReview.content,
                        createdAt: myReview.createdAt,
                        updatedAt: myReview.updatedAt,
                    }
                    : null,
            },
        };
    }

    async createCourseReview(courseId, userId, { rating, content }) {
        const access = await this.assertCanReviewCourse(courseId, userId);
        if (!access.ok) {
            return { success: false, message: access.message };
        }

        const stars = Number(rating);
        const text = String(content || '').trim();
        if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
            return { success: false, message: 'Điểm đánh giá không hợp lệ' };
        }
        if (!text) {
            return { success: false, message: 'Nội dung đánh giá không được để trống' };
        }

        const existing = await CourseReview.findOne({ courseId, userId });
        if (existing) {
            return { success: false, message: 'Bạn đã đánh giá khóa học này rồi' };
        }

        const review = await CourseReview.create({
            courseId,
            userId,
            rating: stars,
            content: text,
        });

        const populated = await CourseReview.findById(review._id)
            .populate('userId', 'fullName avatar')
            .lean();

        return {
            success: true,
            data: {
                _id: populated._id,
                rating: populated.rating,
                content: populated.content,
                createdAt: populated.createdAt,
                updatedAt: populated.updatedAt,
                user: populated.userId
                    ? {
                        _id: populated.userId._id,
                        fullName: populated.userId.fullName,
                        avatar: populated.userId.avatar,
                    }
                    : null,
            },
            stats: await CourseReview.getStatsForCourse(courseId),
        };
    }

    async updateCourseReview(courseId, userId, reviewId, { rating, content }) {
        const review = await CourseReview.findOne({ _id: reviewId, courseId, userId });
        if (!review) {
            return { success: false, message: 'Không tìm thấy đánh giá' };
        }

        if (rating !== undefined) {
            const stars = Number(rating);
            if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
                return { success: false, message: 'Điểm đánh giá không hợp lệ' };
            }
            review.rating = stars;
        }

        if (content !== undefined) {
            const text = String(content).trim();
            if (!text) {
                return { success: false, message: 'Nội dung đánh giá không được để trống' };
            }
            review.content = text;
        }

        await review.save();
        const populated = await CourseReview.findById(review._id)
            .populate('userId', 'fullName avatar')
            .lean();

        return {
            success: true,
            data: {
                _id: populated._id,
                rating: populated.rating,
                content: populated.content,
                createdAt: populated.createdAt,
                updatedAt: populated.updatedAt,
                user: populated.userId
                    ? {
                        _id: populated.userId._id,
                        fullName: populated.userId.fullName,
                        avatar: populated.userId.avatar,
                    }
                    : null,
            },
            stats: await CourseReview.getStatsForCourse(courseId),
        };
    }

    async deleteCourseReview(courseId, userId, reviewId) {
        const review = await CourseReview.findOneAndDelete({ _id: reviewId, courseId, userId });
        if (!review) {
            return { success: false, message: 'Không tìm thấy đánh giá' };
        }

        return {
            success: true,
            stats: await CourseReview.getStatsForCourse(courseId),
        };
    }

    // ===== TEACHER =====
    async getTeacherCourses(teacherId) {
        return Course.find({ teacherId }).sort({ createdAt: -1 });
    }

    async create(data) {
        const course = new Course(data);
        await course.save();
        return course.populate('teacherId', 'fullName avatar');
    }

    async update(id, teacherId, data) {
        const course = await Course.findOne({ _id: id, teacherId });
        if (!course) throw new Error('Course not found or unauthorized');

        Object.assign(course, data);
        await course.save();
        return course;
    }

    async submitForReview(id, teacherId) {
        const course = await Course.findOne({ _id: id, teacherId });
        if (!course) throw new Error('Course not found');
        if (!['draft', 'rejected'].includes(course.status)) {
            throw new Error('Can only submit draft or rejected courses');
        }
        course.status = 'pending';
        course.rejectedReason = undefined;
        await course.save();
        return course;
    }

    async toggleHide(id, teacherId) {
        const course = await Course.findOne({ _id: id, teacherId });
        if (!course) throw new Error('Course not found');
        course.isHidden = !course.isHidden;
        if (course.isHidden) course.status = 'hidden';
        else course.status = 'approved';
        await course.save();
        return course;
    }

    async delete(id, teacherId) {
        const course = await Course.findOne({ _id: id, teacherId });
        if (!course) throw new Error('Course not found');
        if (!['draft', 'rejected'].includes(course.status)) {
            throw new Error('Can only delete draft or rejected courses');
        }
        // Delete related data
        await Chapter.deleteMany({ courseId: id });
        await Lesson.deleteMany({ courseId: id });
        await course.deleteOne();
        return { deleted: true };
    }

    // ===== LEARN (auth + enrolled) =====
    async getLearnData(courseId, userId) {
        const enrollment = await Enrollment.findOne({ userId, courseId, paymentStatus: 'completed' });
        if (!enrollment) throw new Error('Not enrolled');

        const course = await Course.findById(courseId).populate('teacherId', 'name avatar');
        const chapters = await Chapter.find({ courseId }).sort({ order: 1 });
        const lessons = await Lesson.find({ courseId }).sort({ order: 1 });
        const progresses = await Progress.find({ userId, courseId });

        const progressMap = {};
        progresses.forEach(p => { progressMap[p.lessonId.toString()] = p; });

        const chaptersData = chapters.map(ch => {
            const chLessons = lessons.filter(l => l.chapterId.toString() === ch._id.toString());
            return {
                ...ch.toObject(),
                lessons: chLessons.map(l => ({
                    ...l.toObject(),
                    progress: progressMap[l._id.toString()] || null
                }))
            };
        });

        const totalLessons = lessons.length;
        const completedLessons = progresses.filter(p => p.isCompleted).length;

        return {
            course,
            chapters: chaptersData,
            totalLessons,
            completedLessons,
            percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
        };
    }

    // ===== ADMIN =====
    async getAdminList(query = {}) {
        const { status, search, page = 1, limit = 20 } = query;
        const filter = {};
        if (status && status !== 'all') filter.status = status;
        if (search) filter.title = { $regex: search, $options: 'i' };

        const skip = (page - 1) * limit;
        const [courses, total] = await Promise.all([
            Course.find(filter)
                .populate('teacherId', 'fullName avatar')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Course.countDocuments(filter)
        ]);
        return { courses, total, page: Number(page), totalPages: Math.ceil(total / limit) };
    }

    async getAdminOverview(id) {
        const course = await Course.findById(id)
            .populate('teacherId', 'fullName avatar email')
            .lean();
        if (!course) throw new Error('Course not found');

        const enrollCount = await Enrollment.countDocuments({
            courseId: id,
            paymentStatus: 'completed',
        });
        const recentEnrollees = await this.getRecentEnrollees(id, 24);
        const chapterCount = await Chapter.countDocuments({ courseId: id });
        const lessonCount = await Lesson.countDocuments({ courseId: id });

        return {
            course: {
                ...course,
                enrollCount,
            },
            chapterCount,
            lessonCount,
            recentEnrollees,
            enrollCount,
        };
    }

    async approve(id) {
        return Course.findByIdAndUpdate(id, { status: 'approved', rejectedReason: undefined }, { new: true });
    }

    async reject(id, reason) {
        return Course.findByIdAndUpdate(id, { status: 'rejected', rejectedReason: reason }, { new: true });
    }

    async adminUpdate(id, data) {
        return Course.findByIdAndUpdate(id, data, { new: true })
            .populate('teacherId', 'fullName avatar');
    }

    async adminDelete(id) {
        await Chapter.deleteMany({ courseId: id });
        await Lesson.deleteMany({ courseId: id });
        return Course.findByIdAndDelete(id);
    }

    async getStats() {
        const totalCourses = await Course.countDocuments();
        const totalEnrollments = await Enrollment.countDocuments({ paymentStatus: 'completed' });

        // Revenue by month (last 12 months)
        const now = new Date();
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

        const revenueByMonth = await Enrollment.aggregate([
            {
                $match: {
                    paymentStatus: 'completed',
                    paymentMethod: { $in: ['payos', 'coin'] },
                    createdAt: { $gte: twelveMonthsAgo }
                }
            },
            {
                $lookup: {
                    from: 'courses',
                    localField: 'courseId',
                    foreignField: '_id',
                    as: 'course'
                }
            },
            { $unwind: '$course' },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    revenue: { $sum: { $ifNull: ['$course.discountPrice', '$course.price'] } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // New courses by month
        const coursesByMonth = await Course.aggregate([
            { $match: { createdAt: { $gte: twelveMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // This month revenue
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthRevenue = await Enrollment.aggregate([
            {
                $match: {
                    paymentStatus: 'completed',
                    paymentMethod: { $in: ['payos', 'coin'] },
                    createdAt: { $gte: thisMonthStart }
                }
            },
            {
                $lookup: {
                    from: 'courses',
                    localField: 'courseId',
                    foreignField: '_id',
                    as: 'course'
                }
            },
            { $unwind: '$course' },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ['$course.discountPrice', '$course.price'] } }
                }
            }
        ]);

        const statusAggregation = await Course.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const byStatus = {};
        statusAggregation.forEach((item) => {
            if (item._id) byStatus[item._id] = item.count;
        });

        return {
            totalCourses,
            totalEnrollments,
            thisMonthRevenue: thisMonthRevenue[0]?.total || 0,
            revenueByMonth,
            coursesByMonth,
            statusCounts: {
                all: totalCourses,
                pending: byStatus.pending || 0,
                approved: byStatus.approved || 0,
                rejected: byStatus.rejected || 0,
            },
        };
    }

    // ===== USER: My courses =====
    async getUserCourses(userId) {
        const enrollments = await Enrollment.find({ userId, paymentStatus: 'completed' })
            .populate({
                path: 'courseId',
                populate: { path: 'teacherId', select: 'name avatar' }
            })
            .sort({ createdAt: -1 });

        const result = [];
        for (const enr of enrollments) {
            if (!enr.courseId) continue;
            const course = enr.courseId;
            const totalLessons = await Lesson.countDocuments({ courseId: course._id });
            const completedLessons = await Progress.countDocuments({
                userId, courseId: course._id, isCompleted: true
            });

            // Find last lesson in progress (not completed) or first uncompleted
            const lastProgress = await Progress.findOne({ userId, courseId: course._id })
                .sort({ updatedAt: -1 });

            result.push({
                enrollment: enr,
                course,
                totalLessons,
                completedLessons,
                percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
                lastLessonId: lastProgress?.lessonId || null
            });
        }
        return result;
    }

    // Helper: recalculate totals
    async recalculateTotals(courseId) {
        const lessons = await Lesson.find({ courseId });
        const totalLessons = lessons.length;
        const totalDuration = lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
        await Course.findByIdAndUpdate(courseId, { totalLessons, totalDuration });
    }
}

module.exports = new CourseService();