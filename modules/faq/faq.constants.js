const GRADE_LABELS = {
    grade10: 'Tin học 10',
    grade11: 'Tin học 11',
    grade12: 'Tin học 12',
    other: 'Khác',
};

const VALID_GRADES = Object.keys(GRADE_LABELS);

function buildSearchQuery(search) {
    if (!search?.trim()) return null;
    const term = search.trim();
    return {
        $or: [
            { title: { $regex: term, $options: 'i' } },
            { content: { $regex: term, $options: 'i' } },
        ],
    };
}

function applyStatusFilter(query, status) {
    if (!status || status === 'all') return;

    switch (status) {
        case 'open':
            query.answerCount = 0;
            query.isLocked = false;
            break;
        case 'answered':
            query.answerCount = { $gt: 0 };
            query.$or = [
                { bestAnswerId: { $exists: false } },
                { bestAnswerId: null },
            ];
            break;
        case 'solved':
            query.bestAnswerId = { $exists: true, $ne: null };
            break;
        case 'locked':
            query.isLocked = true;
            break;
        default:
            break;
    }
}

module.exports = {
    GRADE_LABELS,
    VALID_GRADES,
    buildSearchQuery,
    applyStatusFilter,
};
