const service = require('./helpcenter.service.admin');

class HelpCenterControllerAdmin {
    
    async getAllFAQs(req, res) {
        try {
            const result = await service.getAllFAQs(req.query);

            res.json({
                success: true,
                data: result.faqs,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get all FAQs error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async createFAQ(req, res) {
        try {
            const userId = req.userId;
            const faq = await service.createFAQ(req.body, userId);

            res.status(201).json({
                success: true,
                message: 'Tạo câu hỏi thành công',
                data: faq
            });
        } catch (error) {
            console.error('Create FAQ error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async updateFAQ(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;
            const faq = await service.updateFAQ(id, req.body, userId);

            res.json({
                success: true,
                message: 'Cập nhật thành công',
                data: faq
            });
        } catch (error) {
            console.error('Update FAQ error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async deleteFAQ(req, res) {
        try {
            const { id } = req.params;
            await service.deleteFAQ(id);

            res.json({
                success: true,
                message: 'Xóa câu hỏi thành công'
            });
        } catch (error) {
            console.error('Delete FAQ error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async updateOrder(req, res) {
        try {
            const { orders } = req.body;
            await service.updateOrder(orders);

            res.json({
                success: true,
                message: 'Cập nhật thứ tự thành công'
            });
        } catch (error) {
            console.error('Update order error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getStats(req, res) {
        try {
           const stats = await service.getStats();

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Get stats error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new HelpCenterControllerAdmin();
