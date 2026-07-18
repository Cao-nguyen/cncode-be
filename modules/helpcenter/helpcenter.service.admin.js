const HelpCenter = require('./helpcenter.model');

class HelpCenterServiceAdmin {
    
    async getAllFAQs(query) {
        const { category, search, page = 1, limit = 20 } = query;

        let dbQuery = {};
        if (category && category !== 'all') {
            dbQuery.category = category;
        }
        if (search) {
            dbQuery.$or = [
                { question: { $regex: search, $options: 'i' } },
                { answer: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [faqs, total] = await Promise.all([
            HelpCenter.find(dbQuery)
                .populate('createdBy', 'fullName email')
                .populate('updatedBy', 'fullName email')
                .sort({ order: 1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            HelpCenter.countDocuments(dbQuery)
        ]);

        return {
            faqs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        };
    }

    async createFAQ(data, userId) {
        const { question, answer, category, order } = data;

        if (!question || !question.trim()) {
            throw new Error('Vui lòng nhập câu hỏi');
        }
        if (!answer || !answer.trim()) {
            throw new Error('Vui lòng nhập câu trả lời');
        }

        const faq = new HelpCenter({
            question: question.trim(),
            answer: answer.trim(),
            category: category || 'other',
            order: order || 0,
            createdBy: userId,
            updatedBy: userId
        });

        await faq.save();
        return faq;
    }

    async updateFAQ(id, data, userId) {
        const { question, answer, category, order, isActive } = data;

        const faq = await HelpCenter.findById(id);
        if (!faq) {
            throw new Error('Không tìm thấy câu hỏi');
        }

        if (question !== undefined) faq.question = question.trim();
        if (answer !== undefined) faq.answer = answer.trim();
        if (category !== undefined) faq.category = category;
        if (order !== undefined) faq.order = order;
        if (isActive !== undefined) faq.isActive = isActive;
        faq.updatedBy = userId;

        await faq.save();
        return faq;
    }

    async deleteFAQ(id) {
        const faq = await HelpCenter.findByIdAndDelete(id);
        if (!faq) {
            throw new Error('Không tìm thấy câu hỏi');
        }
        return faq;
    }

    async updateOrder(orders) {
        for (const item of orders) {
            await HelpCenter.findByIdAndUpdate(item.id, { order: item.order });
        }
    }

    async getStats() {
        const [total, active, inactive, byCategory] = await Promise.all([
            HelpCenter.countDocuments(),
            HelpCenter.countDocuments({ isActive: true }),
            HelpCenter.countDocuments({ isActive: false }),
            HelpCenter.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ])
        ]);

        const categoryStats = {};
        byCategory.forEach(item => {
            categoryStats[item._id] = item.count;
        });

        return {
            total,
            active,
            inactive,
            byCategory: categoryStats
        };
    }
}

module.exports = new HelpCenterServiceAdmin();
