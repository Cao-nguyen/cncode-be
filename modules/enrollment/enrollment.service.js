const Enrollment = require('./enrollment.model');
const Course = require('../khoahoc/khoahoc.model');
const Progress = require('../tiendo/tiendo.model');
const User = require('../user/user.model');

class EnrollmentService {
    async create(data) {
        const existing = await Enrollment.findOne({
            userId: data.userId,
            courseId: data.courseId
        });
        if (existing) return existing;

        const enrollment = new Enrollment(data);
        await enrollment.save();

        // Update enrollCount
        await Course.findByIdAndUpdate(data.courseId, {
            $inc: { enrollCount: 1 }
        });

        return enrollment;
    }

    async getById(id) {
        return Enrollment.findById(id);
    }

    async getByUserAndCourse(userId, courseId) {
        return Enrollment.findOne({ userId, courseId });
    }

    async getByUserId(userId, options = {}) {
        const { page = 1, limit = 100 } = options; // Set a reasonable default limit
        const skip = (page - 1) * limit;

        const enrollments = await Enrollment.find({ userId })
            .populate({
                path: 'courseId',
                populate: {
                    path: 'teacherId',
                    select: 'fullName avatar'
                }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // For each enrollment, get progress data
        const results = [];
        for (const enrollment of enrollments) {
            const course = enrollment.courseId;
            if (!course) continue;

            // Get all progresses for this course and user
            const progresses = await Progress.find({ userId, courseId: course._id });
            const completedLessons = progresses.filter(p => p.isCompleted).length;
            const totalLessons = course.totalLessons || 0;
            const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

            // Get last accessed lesson (the one with most recent updatedAt)
            let lastAccessedLessonId = null;
            let lastAccessedAt = null;
            if (progresses.length > 0) {
                const sortedProgresses = [...progresses].sort((a, b) => 
                    new Date(b.updatedAt) - new Date(a.updatedAt)
                );
                lastAccessedLessonId = sortedProgresses[0].lessonId;
                lastAccessedAt = sortedProgresses[0].updatedAt;
            }

            results.push({
                _id: enrollment._id,
                courseId: course._id,
                title: course.title,
                slug: course.slug,
                thumbnail: course.thumbnail,
                teacherName: course.teacherId?.fullName,
                teacherAvatar: course.teacherId?.avatar,
                totalLessons,
                completedLessons,
                progress,
                lastAccessedLessonId,
                lastAccessedAt,
                enrolledAt: enrollment.createdAt
            });
        }

        return results;
    }

    async updatePaymentStatus(id, status) {
        const enrollment = await Enrollment.findById(id);
        if (!enrollment) return null;

        const oldStatus = enrollment.paymentStatus;
        enrollment.paymentStatus = status;
        await enrollment.save();

        // If status changes to completed, increment enrollCount
        if (oldStatus !== 'completed' && status === 'completed') {
            await Course.findByIdAndUpdate(enrollment.courseId, { $inc: { enrollCount: 1 } });
        }
        // If status changes from completed to something else (e.g., for refunds/cancellations), decrement enrollCount
        else if (oldStatus === 'completed' && status !== 'completed') {
            await Course.findByIdAndUpdate(enrollment.courseId, { $inc: { enrollCount: -1 } });
        }

        return enrollment;
    }

    async delete(id) {
        const enrollment = await Enrollment.findByIdAndDelete(id);
        if (enrollment && enrollment.paymentStatus === 'completed') {
            await Course.findByIdAndUpdate(enrollment.courseId, { $inc: { enrollCount: -1 } });
        }
        return enrollment;
    }
}

module.exports = new EnrollmentService();