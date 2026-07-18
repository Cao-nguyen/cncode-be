const service = require('./helpcenter.service.user');

class HelpCenterControllerUser {
    
    async getFAQs(req, res) {
        try {
            const result = await service.getFAQs(req.query);
            
            const userId = req.userId;
            if (userId && result.faqs.length > 0) {
                result.faqs.forEach(faq => {
                    faq.userLiked = faq.helpfulUsers?.some(
                        uid => uid.toString() === userId.toString()
                    ) || false;
                });
            }

            res.json({
                success: true,
                data: result.faqs,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Get FAQs error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getFAQById(req, res) {
        try {
            const { id } = req.params;
            const faq = await service.getFAQById(id, req.userId);

            res.json({
                success: true,
                data: faq
            });
        } catch (error) {
            console.error('Get FAQ error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async toggleHelpful(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;

            const result = await service.toggleHelpful(id, userId);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Toggle helpful error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new HelpCenterControllerUser();
