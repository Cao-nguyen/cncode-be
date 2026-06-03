const { Slideshow } = require('./slideshow.model');

class SlideshowController {
    // Public: lấy danh sách slide đang active
    async getActiveSlides(req, res) {
        try {
            const slides = await Slideshow.find({ isActive: true })
                .sort({ order: 1 })
                .select('title subtitle description cta href imageUrl gradient');

            res.json({
                success: true,
                data: slides,
            });
        } catch (error) {
            console.error('Get active slides error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Admin: lấy tất cả slide (kể cả inactive)
    async getAllSlides(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [slides, total] = await Promise.all([
                Slideshow.find()
                    .sort({ order: 1 })
                    .skip(skip)
                    .limit(parseInt(limit)),
                Slideshow.countDocuments(),
            ]);

            res.json({
                success: true,
                data: slides,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit)),
                },
            });
        } catch (error) {
            console.error('Get all slides error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Admin: tạo slide mới
    async createSlide(req, res) {
        try {
            const { title, subtitle, description, cta, href, imageUrl, gradient, order, isActive } = req.body;

            if (!title) {
                return res.status(400).json({ success: false, message: 'Tiêu đề là bắt buộc' });
            }

            const slide = new Slideshow({
                title,
                subtitle,
                description,
                cta,
                href,
                imageUrl,
                gradient,
                order,
                isActive,
            });

            await slide.save();

            res.status(201).json({
                success: true,
                data: slide,
                message: 'Tạo slide thành công',
            });
        } catch (error) {
            console.error('Create slide error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Admin: cập nhật slide
    async updateSlide(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const slide = await Slideshow.findByIdAndUpdate(id, updateData, {
                new: true,
                runValidators: true,
            });

            if (!slide) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy slide' });
            }

            res.json({
                success: true,
                data: slide,
                message: 'Cập nhật slide thành công',
            });
        } catch (error) {
            console.error('Update slide error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Admin: xoá slide
    async deleteSlide(req, res) {
        try {
            const { id } = req.params;

            const slide = await Slideshow.findByIdAndDelete(id);

            if (!slide) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy slide' });
            }

            res.json({
                success: true,
                message: 'Xoá slide thành công',
            });
        } catch (error) {
            console.error('Delete slide error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new SlideshowController();