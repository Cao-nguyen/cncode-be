const { TrainingPlace, Industry } = require('./huongnghiep.model');

const getAllTrainingPlaces = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, region, province } = req.query;

        const query = {};
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        if (region) {
            query.region = region;
        }
        if (province) {
            query.province = province;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const trainingPlaces = await TrainingPlace.find(query)
            .populate('createdBy', '_id fullName email avatar username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await TrainingPlace.countDocuments(query);

        res.json({
            success: true,
            data: trainingPlaces,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get all training places error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getTrainingPlaceById = async (req, res) => {
    try {
        const { id } = req.params;

        const trainingPlace = await TrainingPlace.findById(id)
            .populate('createdBy', '_id fullName email avatar username');

        if (!trainingPlace) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy nơi đào tạo' });
        }

        res.json({ success: true, data: trainingPlace });
    } catch (error) {
        console.error('Get training place by ID error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy nơi đào tạo' });
    }
};

const createTrainingPlace = async (req, res) => {
    try {
        const userId = req.userId;
        const { logo, name, region, province, type, description } = req.body;

        const trainingPlace = await TrainingPlace.create({
            logo,
            name,
            region,
            province,
            type,
            description,
            createdBy: userId
        });

        const populated = await TrainingPlace.findById(trainingPlace._id)
            .populate('createdBy', '_id fullName email avatar username');

        res.status(201).json({ success: true, data: populated, message: 'Tạo nơi đào tạo thành công' });
    } catch (error) {
        console.error('Create training place error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const updateTrainingPlace = async (req, res) => {
    try {
        const { id } = req.params;
        const { logo, name, region, province, type, description } = req.body;

        const trainingPlace = await TrainingPlace.findByIdAndUpdate(
            id,
            { logo, name, region, province, type, description },
            { new: true, runValidators: true }
        ).populate('createdBy', '_id fullName email avatar username');

        if (!trainingPlace) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy nơi đào tạo' });
        }

        res.json({ success: true, data: trainingPlace, message: 'Cập nhật nơi đào tạo thành công' });
    } catch (error) {
        console.error('Update training place error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const deleteTrainingPlace = async (req, res) => {
    try {
        const { id } = req.params;

        const trainingPlace = await TrainingPlace.findByIdAndDelete(id);

        if (!trainingPlace) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy nơi đào tạo' });
        }

        res.json({ success: true, message: 'Xóa nơi đào tạo thành công' });
    } catch (error) {
        console.error('Delete training place error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy nơi đào tạo' });
    }
};

// Industry controllers
const getAllIndustries = async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;

        const query = {};
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const industries = await Industry.find(query)
            .populate('createdBy', '_id fullName email avatar username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Industry.countDocuments(query);

        res.json({
            success: true,
            data: industries,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get all industries error:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const getIndustryById = async (req, res) => {
    try {
        const { id } = req.params;

        const industry = await Industry.findById(id)
            .populate('createdBy', '_id fullName email avatar username');

        if (!industry) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ngành nghề' });
        }

        res.json({ success: true, data: industry });
    } catch (error) {
        console.error('Get industry by ID error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy ngành nghề' });
    }
};

const createIndustry = async (req, res) => {
    try {
        const userId = req.userId;
        const { image, name, basicInfo, careerPath, expertAdvice, salary } = req.body;

        const industry = await Industry.create({
            image,
            name,
            basicInfo,
            careerPath,
            expertAdvice,
            salary,
            createdBy: userId
        });

        const populated = await Industry.findById(industry._id)
            .populate('createdBy', '_id fullName email avatar username');

        res.status(201).json({ success: true, data: populated, message: 'Tạo ngành nghề thành công' });
    } catch (error) {
        console.error('Create industry error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const updateIndustry = async (req, res) => {
    try {
        const { id } = req.params;
        const { image, name, basicInfo, careerPath, expertAdvice, salary } = req.body;

        const industry = await Industry.findByIdAndUpdate(
            id,
            { image, name, basicInfo, careerPath, expertAdvice, salary },
            { new: true, runValidators: true }
        ).populate('createdBy', '_id fullName email avatar username');

        if (!industry) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ngành nghề' });
        }

        res.json({ success: true, data: industry, message: 'Cập nhật ngành nghề thành công' });
    } catch (error) {
        console.error('Update industry error:', error);
        res.status(400).json({ success: false, message: error.message || 'Lỗi server' });
    }
};

const deleteIndustry = async (req, res) => {
    try {
        const { id } = req.params;

        const industry = await Industry.findByIdAndDelete(id);

        if (!industry) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ngành nghề' });
        }

        res.json({ success: true, message: 'Xóa ngành nghề thành công' });
    } catch (error) {
        console.error('Delete industry error:', error);
        res.status(404).json({ success: false, message: error.message || 'Không tìm thấy ngành nghề' });
    }
};

module.exports = {
    getAllTrainingPlaces,
    getTrainingPlaceById,
    createTrainingPlace,
    updateTrainingPlace,
    deleteTrainingPlace,
    getAllIndustries,
    getIndustryById,
    createIndustry,
    updateIndustry,
    deleteIndustry
};
