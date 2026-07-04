const mongoose = require('mongoose');
const { HuongNghiep, Workplace, TrainingPlace } = require('./huongnghiep.model');

// Admin: Get all workplaces
const getAllWorkplaces = async (req, res) => {
    try {
        const workplaces = await Workplace.find().sort({ name: 1 });
        res.json({
            success: true,
            data: workplaces,
        });
    } catch (error) {
        console.error('Error in getAllWorkplaces:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Create workplace
const createWorkplace = async (req, res) => {
    try {
        const workplace = await Workplace.create(req.body);
        res.status(201).json({
            success: true,
            data: workplace,
            message: 'Tạo nơi làm việc thành công',
        });
    } catch (error) {
        console.error('Error creating workplace:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: Object.values(error.errors).map(e => e.message),
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Update workplace
const updateWorkplace = async (req, res) => {
    try {
        const workplace = await Workplace.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!workplace) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nơi làm việc',
            });
        }
        res.json({
            success: true,
            data: workplace,
            message: 'Cập nhật nơi làm việc thành công',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Delete workplace
const deleteWorkplace = async (req, res) => {
    try {
        const workplace = await Workplace.findByIdAndDelete(req.params.id);
        if (!workplace) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nơi làm việc',
            });
        }
        res.json({
            success: true,
            message: 'Xóa nơi làm việc thành công',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Get all training places
const getAllTrainingPlaces = async (req, res) => {
    try {
        const trainingPlaces = await TrainingPlace.find().sort({ name: 1 });
        res.json({
            success: true,
            data: trainingPlaces,
        });
    } catch (error) {
        console.error('Error in getAllTrainingPlaces:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Create training place
const createTrainingPlace = async (req, res) => {
    try {
        const trainingPlace = await TrainingPlace.create(req.body);
        res.status(201).json({
            success: true,
            data: trainingPlace,
            message: 'Tạo nơi đào tạo thành công',
        });
    } catch (error) {
        console.error('Error creating training place:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: Object.values(error.errors).map(e => e.message),
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Update training place
const updateTrainingPlace = async (req, res) => {
    try {
        const trainingPlace = await TrainingPlace.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!trainingPlace) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nơi đào tạo',
            });
        }
        res.json({
            success: true,
            data: trainingPlace,
            message: 'Cập nhật nơi đào tạo thành công',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Delete training place
const deleteTrainingPlace = async (req, res) => {
    try {
        const trainingPlace = await TrainingPlace.findByIdAndDelete(req.params.id);
        if (!trainingPlace) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nơi đào tạo',
            });
        }
        res.json({
            success: true,
            message: 'Xóa nơi đào tạo thành công',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Get statistics
const getStats = async (req, res) => {
    try {
        const stats = await HuongNghiep.aggregate([
            {
                $group: {
                    _id: '$group',
                    count: { $sum: 1 },
                },
            },
        ]);

        const result = {
            A: 0,
            B: 0,
            C: 0,
            D: 0,
            total: 0,
        };

        stats.forEach((stat) => {
            result[stat._id] = stat.count;
            result.total += stat.count;
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Get all industries
const getAllIndustries = async (req, res) => {
    try {
        const { page = 1, limit = 10, group, search, isPublished } = req.query;
        const skip = (page - 1) * limit;

        const query = {};

        if (group && group !== 'all') {
            query.group = group;
        }

        if (isPublished !== undefined) {
            query.isPublished = isPublished === 'true';
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { 'overview.introduction': { $regex: search, $options: 'i' } },
            ];
        }

        const [industries, total] = await Promise.all([
            HuongNghiep.find(query)
                .populate('createdBy', 'fullName avatar')
                .populate('jobOpportunities')
                .populate('trainingPlaces')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            HuongNghiep.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: industries,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Get industry by ID
const getIndustryById = async (req, res) => {
    try {
        const industry = await HuongNghiep.findById(req.params.id)
            .populate('createdBy', 'fullName avatar')
            .populate('jobOpportunities')
            .populate('trainingPlaces');

        if (!industry) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ngành',
            });
        }

        res.json({
            success: true,
            data: industry,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Create industry
const createIndustry = async (req, res) => {
    try {
        const data = req.body;
        data.createdBy = req.userId;

        // Handle workplaces - only store references
        if (data.jobOpportunities) {
            // Extract only the _id references
            data.jobOpportunities = data.jobOpportunities
                .filter(wp => wp._id)
                .map(wp => wp._id);
        }

        // Handle training places - only store references
        if (data.trainingPlaces) {
            // Extract only the _id references
            data.trainingPlaces = data.trainingPlaces
                .filter(tp => tp._id)
                .map(tp => tp._id);
        }

        const industry = await HuongNghiep.create(data);

        const populatedIndustry = await HuongNghiep.findById(industry._id)
            .populate('createdBy', 'fullName avatar')
            .populate('jobOpportunities')
            .populate('trainingPlaces');

        res.status(201).json({
            success: true,
            data: populatedIndustry,
            message: 'Tạo ngành thành công',
        });
    } catch (error) {
        console.error('Error creating industry:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: Object.values(error.errors).map(e => e.message),
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Update industry
const updateIndustry = async (req, res) => {
    try {
        const industry = await HuongNghiep.findById(req.params.id);

        if (!industry) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ngành',
            });
        }

        const data = req.body;
        data.updatedBy = req.userId;

        // Handle workplaces - only store references, don't recreate
        if (data.jobOpportunities) {
            // Extract only the _id references
            data.jobOpportunities = data.jobOpportunities
                .filter(wp => wp._id)
                .map(wp => wp._id);
        }

        // Handle training places - only store references, don't recreate
        if (data.trainingPlaces) {
            // Extract only the _id references
            data.trainingPlaces = data.trainingPlaces
                .filter(tp => tp._id)
                .map(tp => tp._id);
        }

        Object.assign(industry, data);
        await industry.save();

        const populatedIndustry = await HuongNghiep.findById(industry._id)
            .populate('createdBy', 'fullName avatar')
            .populate('jobOpportunities')
            .populate('trainingPlaces');

        res.json({
            success: true,
            data: populatedIndustry,
            message: 'Cập nhật ngành thành công',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Delete industry
const deleteIndustry = async (req, res) => {
    try {
        const industry = await HuongNghiep.findById(req.params.id);

        if (!industry) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ngành',
            });
        }

        // Delete associated workplaces and training places
        await Workplace.deleteMany({ _id: { $in: industry.jobOpportunities } });
        await TrainingPlace.deleteMany({ _id: { $in: industry.trainingPlaces } });

        await HuongNghiep.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Xóa ngành thành công',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Admin: Toggle publish status
const togglePublish = async (req, res) => {
    try {
        const industry = await HuongNghiep.findById(req.params.id);

        if (!industry) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ngành',
            });
        }

        industry.isPublished = !industry.isPublished;
        industry.updatedBy = req.userId;
        await industry.save();

        res.json({
            success: true,
            data: industry,
            message: industry.isPublished ? 'Đã xuất bản ngành' : 'Đã ẩn ngành',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Public: Get published industries by group
const getIndustriesByGroup = async (req, res) => {
    try {
        const { group } = req.params;
        const { limit = 20 } = req.query;

        const industries = await HuongNghiep.find({
            group,
            isPublished: true,
        })
            .select('name slug thumbnail overview.introduction overview.salaryMin overview.salaryMax')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: industries,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Public: Get industry by slug
const getIndustryBySlug = async (req, res) => {
    try {
        const industry = await HuongNghiep.findOne({
            slug: req.params.slug,
            isPublished: true,
        })
            .populate('jobOpportunities')
            .populate('trainingPlaces');

        if (!industry) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ngành',
            });
        }

        res.json({
            success: true,
            data: industry,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    getStats,
    getAllIndustries,
    getIndustryById,
    createIndustry,
    updateIndustry,
    deleteIndustry,
    togglePublish,
    getIndustriesByGroup,
    getIndustryBySlug,
    getAllWorkplaces,
    createWorkplace,
    updateWorkplace,
    deleteWorkplace,
    getAllTrainingPlaces,
    createTrainingPlace,
    updateTrainingPlace,
    deleteTrainingPlace,
};
