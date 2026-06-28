const Progress = require('./tiendo.model');
const Lesson = require('../baihoc/baihoc.model');
const Chapter = require('../chuong/chuong.model');
const Enrollment = require('../enrollment/enrollment.model');

class ProgressService {
    async upsertProgress(userId, lessonId, data) {
        const { watchedSeconds, isCompleted } = data;
        const existing = await Progress.findOne({ userId, lessonId });

        if (existing) {
            existing.watchedSeconds = watchedSeconds ?? existing.watchedSeconds;
            if (isCompleted) {
                existing.isCompleted = true;
                existing.completedAt = new Date();
            }
            await existing.save();
            return existing;
        }

        const lesson = await Lesson.findById(lessonId);
        if (!lesson) throw new Error('Lesson not found');

        const progress = await Progress.create({
            userId,
            lessonId,
            courseId: lesson.courseId,
            watchedSeconds: watchedSeconds || 0,
            isCompleted: isCompleted || false,
            completedAt: isCompleted ? new Date() : undefined,
        });

        return progress;
    }

    async getProgress(userId, lessonId) {
        return Progress.findOne({ userId, lessonId });
    }

    async getCourseProgress(userId, courseId) {
        const progresses = await Progress.find({ userId, courseId });
        const total = await Lesson.countDocuments({ courseId });
        const completed = progresses.filter((p) => p.isCompleted).length;
        return {
            total,
            completed,
            percent: total > 0 ? Math.round((completed / total) * 100) : 0,
            progresses,
        };
    }

    async checkCourseCompleted(userId, courseId) {
        const { total, completed } = await this.getCourseProgress(userId, courseId);
        return total > 0 && completed >= total;
    }
}

module.exports = new ProgressService();