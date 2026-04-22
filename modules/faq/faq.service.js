// modules/faq/faq.service.js
const FAQ = require('./faq.model');

class FAQService {
    async getAllFAQs(filters = {}, page = 1, limit = 50) {
        const { category, search, isActive } = filters;
        const query = {};

        // Nếu isActive không phải 'all' thì mới lọc
        if (isActive !== 'all' && isActive !== undefined) {
            query.isActive = isActive === 'true' || isActive === true;
        }

        if (category && category !== 'all') {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { question: { $regex: search, $options: 'i' } },
                { answer: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const [faqs, total] = await Promise.all([
            FAQ.find(query)
                .sort({ order: 1, createdAt: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FAQ.countDocuments(query)
        ]);

        return { faqs, total, page, totalPages: Math.ceil(total / limit) };
    }

    async getFAQById(id) {
        const faq = await FAQ.findById(id).lean();
        if (!faq) throw new Error('FAQ not found');
        return faq;
    }

    async createFAQ(data, userId) {
        const faq = new FAQ({
            ...data,
            createdBy: userId,
            updatedBy: userId
        });
        await faq.save();
        return faq;
    }

    async updateFAQ(id, data, userId) {
        const faq = await FAQ.findById(id);
        if (!faq) throw new Error('FAQ not found');

        Object.assign(faq, data);
        faq.updatedBy = userId;
        await faq.save();

        return faq;
    }

    async deleteFAQ(id) {
        const faq = await FAQ.findById(id);
        if (!faq) throw new Error('FAQ not found');
        await faq.deleteOne();
        return faq;
    }

    async updateHelpful(id, isHelpful) {
        const faq = await FAQ.findById(id);
        if (!faq) throw new Error('FAQ not found');

        if (isHelpful) {
            faq.helpful += 1;
        } else {
            faq.notHelpful += 1;
        }
        await faq.save();

        return { helpful: faq.helpful, notHelpful: faq.notHelpful };
    }

    async incrementView(id) {
        await FAQ.findByIdAndUpdate(id, { $inc: { views: 1 } });
    }
}

module.exports = new FAQService();