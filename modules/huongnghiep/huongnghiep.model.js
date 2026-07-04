const mongoose = require('mongoose');
const { generateSlug } = require('../../utils/slug');

const workplaceSchema = new mongoose.Schema({
    image: {
        type: String,
        default: '',
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    address: {
        type: String,
        trim: true,
    },
});

const trainingPlaceSchema = new mongoose.Schema({
    logo: {
        type: String,
        default: '',
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    strengths: {
        type: String,
        trim: true,
    },
    location: {
        type: String,
        trim: true,
    },
    region: {
        type: String,
        enum: ['Miền Bắc', 'Miền Trung', 'Miền Nam'],
        required: true,
    },
    type: {
        type: String,
        enum: ['Tư thục', 'Công lập'],
        required: true,
    },
    majorsCount: {
        type: Number,
        default: 1,
    },
    tuitionMin: {
        type: Number,
        default: 0,
    },
    tuitionMax: {
        type: Number,
        default: 0,
    },
});

const huongnghiepSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Tên ngành là bắt buộc'],
            trim: true,
            maxlength: 200,
        },
        slug: {
            type: String,
            unique: true,
            index: true,
        },
        group: {
            type: String,
            enum: ['A', 'B', 'C', 'D'],
            required: true,
            index: true,
        },
        // Tab 1: Tổng quan
        overview: {
            introduction: {
                type: String,
                default: '',
            },
            salaryMin: {
                type: Number,
                default: 0,
                min: 0,
            },
            salaryMax: {
                type: Number,
                default: 0,
                min: 0,
            },
            demandLevel: {
                type: String,
                enum: ['Không cao', 'Bình thường', 'Cao', 'Rất cao'],
                default: 'Bình thường',
            },
            trainingDurationMin: {
                type: Number,
                default: 0,
                min: 0,
            },
            trainingDurationMax: {
                type: Number,
                default: 0,
                min: 0,
            },
            whatIndustryDoes: [{
                type: String,
                trim: true,
            }],
        },
        // Tab 2: Kiến thức
        knowledge: [{
            type: String,
            trim: true,
        }],
        // Tab 3: Yêu cầu
        requirements: [{
            type: String,
            trim: true,
        }],
        // Tab 4: Kỹ năng
        skills: [{
            type: String,
            trim: true,
        }],
        // Tab 5: Lời khuyên của chuyên gia
        expertAdvice: {
            type: String,
            default: '',
        },
        // Tab 6: Cơ hội việc làm
        jobOpportunities: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workplace',
        }],
        // Tab 7: Nơi đào tạo
        trainingPlaces: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TrainingPlace',
        }],
        // Metadata
        thumbnail: {
            type: String,
            default: '',
        },
        isPublished: {
            type: Boolean,
            default: false,
        },
        publishedAt: {
            type: Date,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

huongnghiepSchema.index({ group: 1, isPublished: 1 });
huongnghiepSchema.index({ createdBy: 1, createdAt: -1 });
huongnghiepSchema.index({ slug: 1 });

huongnghiepSchema.pre('save', function (next) {
    if (this.isModified('name') && !this.slug) {
        this.slug = generateSlug(this.name);
    }

    if (this.isModified('isPublished') && this.isPublished && !this.publishedAt) {
        this.publishedAt = new Date();
    }

    next();
});

const HuongNghiep = mongoose.models.HuongNghiep || mongoose.model('HuongNghiep', huongnghiepSchema);
const Workplace = mongoose.models.Workplace || mongoose.model('Workplace', workplaceSchema);
const TrainingPlace = mongoose.models.TrainingPlace || mongoose.model('TrainingPlace', trainingPlaceSchema);

module.exports = { HuongNghiep, Workplace, TrainingPlace };
