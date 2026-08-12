const HelpCenter = require('./helpcenter.model');

const getAllFAQs = async (page = 1, limit = 20, search = '', category = 'all') => {
    let dbQuery = {};
    if (category && category !== 'all') {
        dbQuery.category = category;
    }
    if (search && search.trim()) {
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
};

const createFAQ = async (data, userId) => {
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
};

const updateFAQ = async (id, data, userId) => {
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
};

const deleteFAQ = async (id) => {
    const faq = await HelpCenter.findByIdAndDelete(id);
    if (!faq) {
        throw new Error('Không tìm thấy câu hỏi');
    }
    return faq;
};

const updateOrder = async (orders) => {
    for (const item of orders) {
        await HelpCenter.findByIdAndUpdate(item.id, { order: item.order });
    }
};

const getStats = async () => {
    const [total, active, inactive, byCategory, aggregates] = await Promise.all([
        HelpCenter.countDocuments(),
        HelpCenter.countDocuments({ isActive: true }),
        HelpCenter.countDocuments({ isActive: false }),
        HelpCenter.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]),
        HelpCenter.aggregate([
            {
                $group: {
                    _id: null,
                    totalViews: { $sum: '$views' },
                    totalHelpful: { $sum: '$helpfulCount' }
                }
            }
        ])
    ]);

    const categoryStats = {};
    byCategory.forEach(item => {
        categoryStats[item._id] = item.count;
    });

    const summary = aggregates[0] || { totalViews: 0, totalHelpful: 0 };

    return {
        total,
        active,
        inactive,
        totalViews: summary.totalViews || 0,
        totalHelpful: summary.totalHelpful || 0,
        byCategory: categoryStats
    };
};

module.exports = {
    getAllFAQs,
    createFAQ,
    updateFAQ,
    deleteFAQ,
    updateOrder,
    getStats
};
