const CATEGORIES = ['bug', 'ui_ux', 'feature_request', 'performance', 'security', 'other'];
const STATUSES = ['pending', 'viewed', 'approved', 'improving', 'completed', 'rejected'];
const PRIORITIES = ['low', 'medium', 'high'];

const CATEGORY_LABELS = {
    bug: 'Lỗi/Bug',
    ui_ux: 'UI/UX',
    feature_request: 'Tính năng mới',
    performance: 'Hiệu năng',
    security: 'Bảo mật',
    other: 'Khác',
};

const STATUS_LABELS = {
    pending: 'Chờ xử lý',
    viewed: 'Đã xem',
    approved: 'Đã duyệt',
    improving: 'Đang cải tiến',
    completed: 'Hoàn thành',
    rejected: 'Từ chối',
};

const PRIORITY_LABELS = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
};

const LIST_SORT = { isPinned: -1, createdAt: -1 };

function attachFeedbackMeta(items, userId = null) {
    return items.map((item) => {
        const feedback = typeof item.toObject === 'function' ? item.toObject() : { ...item };
        if (userId) {
            feedback.userLiked = (feedback.likedBy || []).some(
                (id) => id.toString() === userId.toString(),
            );
        }
        delete feedback.likedBy;
        return feedback;
    });
}

module.exports = {
    CATEGORIES,
    STATUSES,
    PRIORITIES,
    CATEGORY_LABELS,
    STATUS_LABELS,
    PRIORITY_LABELS,
    LIST_SORT,
    attachFeedbackMeta,
};
