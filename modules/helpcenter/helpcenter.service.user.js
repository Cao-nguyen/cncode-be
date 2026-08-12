const HelpCenter = require('./helpcenter.model');
const { recordUniqueView } = require('../../utils/uniqueView');

class HelpCenterServiceUser {
    
    async getFAQs(query) {
        const { category, search, page = 1, limit = 50 } = query;

        let dbQuery = { isActive: true };
        if (category && category !== 'all') {
            dbQuery.category = category;
        }
        if (search && search.trim()) {
            dbQuery.$text = { $search: search.trim() };
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

    async incrementViewCount(id, userId = null, guestId = null) {
        const faq = await HelpCenter.findOne({ _id: id, isActive: true });
        if (!faq) {
            throw new Error('Không tìm thấy câu hỏi');
        }

        const result = await recordUniqueView({
            targetType: 'help_center',
            targetId: faq._id,
            userId,
            guestId,
            incrementFn: async () => {
                await HelpCenter.findByIdAndUpdate(faq._id, { $inc: { views: 1 } });
            },
            getViewsFn: async () => {
                const doc = await HelpCenter.findById(faq._id).select('views').lean();
                return doc?.views || 0;
            },
        });

        return result;
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
