const Chapter = require('./chuong.model');
const KHLesson = require('../baihoc/baihoc.model');

class ChapterService {
    async create(data) {
        const chapter = new Chapter(data);
        await chapter.save();
        return chapter;
    }

    async getById(id) {
        return Chapter.findById(id);
    }

    async getByCourseId(courseId, options = {}) {
        const { sort = 'order' } = options;
        const chapters = await Chapter.find({ courseId }).sort(sort).lean();
        const lessons = await KHLesson.find({ courseId }).sort('order').lean();
        return chapters.map(ch => ({
            ...ch,
            lessons: lessons.filter(l => String(l.chapterId) === String(ch._id))
        }));
    }

    async update(id, data) {
        return Chapter.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id) {
        return Chapter.findByIdAndDelete(id);
    }

    async reorder(courseId, chapters) {
        // chapters = [{ _id, order }, ...]
        const updates = chapters.map(ch => ({
            updateOne: {
                filter: { _id: ch._id, courseId },
                update: { order: ch.order }
            }
        }));
        return Chapter.bulkWrite(updates);
    }
}

module.exports = new ChapterService();