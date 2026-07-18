const HelpCenter = require('./helpcenter.model');

class HelpCenterServiceUser {
    
    async getFAQs(query) {
        const { category, search, page = 1, limit = 50 } = query;

        let dbQuery = { isActive: true };
        if (category && category !== 'all') {
            dbQuery.category = category;
        }
        if (search) {
            dbQuery.$text = { $search: search };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [faqs, total] = await Promise.all([
            HelpCenter.find(dbQuery)
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

    async getFAQById(id, userId) {
        await HelpCenter.findByIdAndUpdate(id, { $inc: { views: 1 } });

        const faq = await HelpCenter.findById(id).lean();
        if (!faq) {
            throw new Error('Không tìm thấy câu hỏi');
        }

        if (userId) {
            faq.userLiked = faq.helpfulUsers?.some(
                uid => uid.toString() === userId.toString()
            ) || false;
        }

        return faq;
    }

    async toggleHelpful(id, userId) {
        const faq = await HelpCenter.findById(id);
        if (!faq) {
            throw new Error('Không tìm thấy câu hỏi');
        }

        const hasLiked = faq.helpfulUsers.includes(userId);

        if (hasLiked) {
            faq.helpfulCount -= 1;
            faq.helpfulUsers = faq.helpfulUsers.filter(
                uid => uid.toString() !== userId
            );
        } else {
            faq.helpfulCount += 1;
            faq.helpfulUsers.push(userId);
        }

        await faq.save();

        return {
            helpfulCount: faq.helpfulCount,
            userLiked: !hasLiked
        };
    }
}

module.exports = new HelpCenterServiceUser();
