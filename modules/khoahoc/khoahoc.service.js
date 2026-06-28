const Course = require('./khoahoc.model');
const Chapter = require('../chuong/chuong.model');
const Lesson = require('../baihoc/baihoc.model');
const Enrollment = require('../enrollment/enrollment.model');
const Progress = require('../tiendo/tiendo.model');

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

        return { course: courseWithEnrollCount, chapters: chaptersWithLessons };
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

        return {
            totalCourses,
            totalEnrollments,
            thisMonthRevenue: thisMonthRevenue[0]?.total || 0,
            revenueByMonth,
            coursesByMonth
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