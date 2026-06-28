const Lesson = require('./baihoc.model');
const { Innertube } = require('youtubei.js');
const courseService = require('../khoahoc/khoahoc.service');

let youtube; // singleton

async function getYoutubeClient() {
    if (!youtube) {
        youtube = await Innertube.create();
    }
    return youtube;
}

async function fetchYoutubeDuration(videoUrl) {
    try {
        // Extract video ID từ URL hoặc dùng thẳng nếu là ID
        const match = videoUrl.match(
            /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        const videoId = match ? match[1] : videoUrl;

        const yt = await getYoutubeClient();
        const info = await yt.getBasicInfo(videoId);
        const seconds = info?.basic_info?.duration;

        return seconds ? parseInt(seconds) : null;
    } catch (error) {
        console.error('Error fetching YouTube duration:', error.message);
        return null;
    }
}

class LessonService {
    async create(data) {
        if (data.type === 'video' && data.videoFileId && !data.duration) {
            const duration = await fetchYoutubeDuration(data.videoFileId);
            if (duration) data.duration = duration;
        }

        const lesson = new Lesson(data);
        await lesson.save();

        // Recalculate course totals
        if (lesson.courseId) {
            await courseService.recalculateTotals(lesson.courseId);
        }

        return lesson;
    }

    async getById(id) {
        return Lesson.findById(id);
    }

    async getByChapterId(chapterId, options = {}) {
        const { sort = 'order' } = options;
        return Lesson.find({ chapterId }).sort(sort);
    }

    async getByCourseId(courseId) {
        return Lesson.find({ courseId });
    }

    async update(id, data) {
        if (data.type === 'video' && data.videoFileId && !data.duration) {
            const duration = await fetchYoutubeDuration(data.videoFileId);
            if (duration) data.duration = duration;
        }

        const lesson = await Lesson.findByIdAndUpdate(id, data, { new: true });

        // Recalculate course totals
        if (lesson && lesson.courseId) {
            await courseService.recalculateTotals(lesson.courseId);
        }

        return lesson;
    }

    async delete(id) {
        const lesson = await Lesson.findById(id);
        if (!lesson) return null;

        const courseId = lesson.courseId;
        await Lesson.findByIdAndDelete(id);

        // Recalculate course totals
        if (courseId) {
            await courseService.recalculateTotals(courseId);
        }

        return lesson;
    }

    async reorder(chapterId, lessons) {
        const updates = lessons.map(l => ({
            updateOne: {
                filter: { _id: l._id, chapterId },
                update: { order: l.order }
            }
        }));
        return Lesson.bulkWrite(updates);
    }

    async getPreviewLessons(courseId) {
        return Lesson.find({ courseId, isPreview: true });
    }
}

module.exports = new LessonService();