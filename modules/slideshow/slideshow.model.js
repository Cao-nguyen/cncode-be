const mongoose = require('mongoose');

const slideshowSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Tiêu đề là bắt buộc'],
            trim: true,
            maxlength: 200,
        },
        subtitle: {
            type: String,
            trim: true,
            default: '',
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        cta: {
            type: String,
            trim: true,
            default: 'Khám phá ngay',
        },
        href: {
            type: String,
            trim: true,
            default: '/',
        },
        /** Link ảnh (có thể upload lên Telegram hoặc nhập URL) */
        imageUrl: {
            type: String,
            default: '',
        },
        /** Kích thước ảnh */
        imageWidth: {
            type: Number,
            default: 0,
        },
        imageHeight: {
            type: Number,
            default: 0,
        },
        /**
         * Màu nền gradient dạng "from-red-500 via-orange-500 to-yellow-500"
         * Nếu có ảnh thì vẫn hiển thị gradient làm lớp nền phụ
         */
        gradient: {
            type: String,
            default: 'from-blue-500 via-indigo-500 to-violet-500',
        },
        /** Vị trí hiển thị (thứ tự sắp xếp) */
        order: {
            type: Number,
            default: 0,
        },
        /** Trạng thái kích hoạt */
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

slideshowSchema.index({ order: 1, isActive: 1 });

const Slideshow = mongoose.models.Slideshow || mongoose.model('Slideshow', slideshowSchema);

module.exports = { Slideshow };