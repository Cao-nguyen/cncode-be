const mongoose = require('mongoose');

const trainingPlaceSchema = new mongoose.Schema(
    {
        logo: {
            type: String,
            default: '',
        },
        name: {
            type: String,
            required: [true, 'Tên nơi đào tạo là bắt buộc'],
            trim: true,
            maxlength: 200,
        },
        region: {
            type: String,
            enum: ['Miền Bắc', 'Miền Trung', 'Miền Nam'],
            required: [true, 'Khu vực là bắt buộc'],
        },
        province: {
            type: String,
            required: [true, 'Tỉnh/Thành phố là bắt buộc'],
            trim: true,
        },
        type: {
            type: String,
            enum: ['Công lập', 'Tư thục'],
            required: [true, 'Loại hình là bắt buộc'],
        },
        description: {
            type: String,
            required: [true, 'Giới thiệu là bắt buộc'],
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true }
);

trainingPlaceSchema.index({ region: 1, province: 1 });
trainingPlaceSchema.index({ name: 1 });

const TrainingPlace = mongoose.models.TrainingPlace || mongoose.model('TrainingPlace', trainingPlaceSchema);

const industrySchema = new mongoose.Schema(
    {
        image: {
            type: String,
            default: '',
        },
        name: {
            type: String,
            required: [true, 'Tên ngành nghề là bắt buộc'],
            trim: true,
            maxlength: 200,
        },
        basicInfo: {
            type: String,
            required: [true, 'Cơ bản về ngành nghề là bắt buộc'],
        },
        careerPath: {
            type: String,
            required: [true, 'Học xong làm gì là bắt buộc'],
        },
        expertAdvice: {
            type: String,
            required: [true, 'Lời khuyên từ chuyên gia là bắt buộc'],
        },
        salary: {
            type: String,
            required: [true, 'Mức lương là bắt buộc'],
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true }
);

industrySchema.index({ name: 1 });

const Industry = mongoose.models.Industry || mongoose.model('Industry', industrySchema);

module.exports = { TrainingPlace, Industry };
