const Enrollment = require('./enrollment.model');
const Course = require('../khoahoc/khoahoc.model');

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
        const { page = 1, limit = 10 } = options;
        const skip = (page - 1) * limit;
        return Enrollment.find({ userId })
            .populate('courseId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
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