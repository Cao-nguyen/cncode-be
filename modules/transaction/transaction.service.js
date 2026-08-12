const CoinTransaction = require('../coin/coin.model');
const Enrollment = require('../enrollment/enrollment.model');
const Course = require('../khoahoc/khoahoc.model');
const PracticeExercisePurchase = require('../luyentap/luyentapPurchase.model');
const { PracticeExercise } = require('../luyentap/luyentap.model');
const User = require('../user/user.model');

function mapEnrollmentPayosStatus(status) {
    if (status === 'completed') return 'completed';
    return 'pending';
}

function mapPurchasePayosStatus(status) {
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';
    return 'pending';
}

function getCoursePayableAmount(course) {
    if (!course || course.type !== 'pro') return 0;
    return course.discountPrice ?? course.price ?? 0;
}

function formatUser(user) {
    if (!user) return null;
    if (typeof user === 'string') return { _id: user };
    return {
        _id: String(user._id),
        fullName: user.fullName || user.name || '',
        email: user.email || '',
        username: user.username || '',
    };
}

function paginateItems(items, page, limit) {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * limit;
    return {
        items: items.slice(start, start + limit),
        pagination: {
            page: safePage,
            limit,
            total,
            totalPages,
        },
    };
}

async function findUserIdsBySearch(search) {
    if (!search?.trim()) return null;
    const q = search.trim();
    const users = await User.find({
        $or: [
            { fullName: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
            { username: { $regex: q, $options: 'i' } },
        ],
    }).select('_id').lean();
    return users.map((u) => u._id);
}

async function buildPayosTransactions(enrollments, luyentapPurchases, userMap = {}) {
    const courseIds = [...new Set(enrollments.map((e) => String(e.courseId)).filter(Boolean))];
    const exerciseIds = [...new Set(luyentapPurchases.map((p) => String(p.exerciseId)).filter(Boolean))];

    const [courses, exercises] = await Promise.all([
        courseIds.length
            ? Course.find({ _id: { $in: courseIds } }).select('title price discountPrice type').lean()
            : [],
        exerciseIds.length
            ? PracticeExercise.find({ _id: { $in: exerciseIds } }).select('title price discountPrice tier').lean()
            : [],
    ]);

    const courseMap = Object.fromEntries(courses.map((c) => [String(c._id), c]));
    const exerciseMap = Object.fromEntries(exercises.map((e) => [String(e._id), e]));

    const payosFromCourses = enrollments
        .filter((e) => e.paymentMethod === 'payos' || e.orderCode)
        .map((enrollment) => {
            const course = courseMap[String(enrollment.courseId)];
            const user = userMap[String(enrollment.userId)] || enrollment.userId;
            return {
                id: String(enrollment._id),
                title: course?.title || 'Khóa học',
                amount: getCoursePayableAmount(course),
                orderCode: enrollment.orderCode ? String(enrollment.orderCode) : '—',
                status: mapEnrollmentPayosStatus(enrollment.paymentStatus),
                category: 'course',
                relatedId: String(enrollment.courseId),
                user: formatUser(user),
                createdAt: enrollment.enrolledAt || enrollment.updatedAt || enrollment.createdAt,
            };
        });

    const payosFromLuyentap = luyentapPurchases
        .filter((p) => p.paymentMethod === 'payos' || p.orderCode)
        .map((purchase) => {
            const exercise = exerciseMap[String(purchase.exerciseId)];
            const user = userMap[String(purchase.userId)] || purchase.userId;
            return {
                id: String(purchase._id),
                title: exercise?.title || 'Đề luyện tập',
                amount: purchase.amount ?? exercise?.discountPrice ?? exercise?.price ?? 0,
                orderCode: purchase.orderCode ? String(purchase.orderCode) : '—',
                status: mapPurchasePayosStatus(purchase.paymentStatus),
                category: 'luyentap',
                relatedId: String(purchase.exerciseId),
                user: formatUser(user),
                createdAt: purchase.purchasedAt || purchase.updatedAt || purchase.createdAt,
            };
        });

    return [...payosFromCourses, ...payosFromLuyentap]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function mapCoinRow(t, user) {
    return {
        id: String(t._id),
        type: t.type,
        amount: t.amount,
        reason: t.reason,
        balanceAfter: t.balanceAfter,
        relatedType: t.relatedType || null,
        relatedId: t.relatedId ? String(t.relatedId) : null,
        user: formatUser(user || t.userId),
        createdAt: t.createdAt,
    };
}

class TransactionService {
    async getPlatformStats() {
        const [
            coinAgg,
            payosEnrollments,
            payosPurchases,
            totalCoinCount,
        ] = await Promise.all([
            CoinTransaction.aggregate([
                {
                    $group: {
                        _id: '$type',
                        total: { $sum: '$amount' },
                    },
                },
            ]),
            Enrollment.countDocuments({
                $or: [{ paymentMethod: 'payos' }, { orderCode: { $exists: true, $ne: null } }],
            }),
            PracticeExercisePurchase.countDocuments({
                $or: [{ paymentMethod: 'payos' }, { orderCode: { $exists: true, $ne: null } }],
            }),
            CoinTransaction.countDocuments(),
        ]);

        const credit = coinAgg.find((x) => x._id === 'credit')?.total || 0;
        const debit = coinAgg.find((x) => x._id === 'debit')?.total || 0;

        const [completedEnrollments, completedPurchases] = await Promise.all([
            Enrollment.find({
                paymentStatus: 'completed',
                $or: [{ paymentMethod: 'payos' }, { orderCode: { $exists: true, $ne: null } }],
            }).select('courseId').lean(),
            PracticeExercisePurchase.find({
                paymentStatus: 'completed',
                $or: [{ paymentMethod: 'payos' }, { orderCode: { $exists: true, $ne: null } }],
            }).select('exerciseId amount').lean(),
        ]);

        const courseIds = [...new Set(completedEnrollments.map((e) => String(e.courseId)))];
        const courses = courseIds.length
            ? await Course.find({ _id: { $in: courseIds } }).select('price discountPrice type').lean()
            : [];
        const courseMap = Object.fromEntries(courses.map((c) => [String(c._id), c]));

        const payosCompletedTotal =
            completedEnrollments.reduce((sum, e) => sum + getCoursePayableAmount(courseMap[String(e.courseId)]), 0)
            + completedPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);

        return {
            coinCreditTotal: credit,
            coinDebitTotal: debit,
            payosCompletedTotal,
            payosCompletedCount: completedEnrollments.length + completedPurchases.length,
            totalCoinCount,
            totalPayosCount: payosEnrollments + payosPurchases,
        };
    }

    async getUserHistory(userId) {
        const [user, coinTransactions, enrollments, luyentapPurchases] = await Promise.all([
            User.findById(userId).select('coins').lean(),
            CoinTransaction.find({ userId }).sort({ createdAt: -1 }).lean(),
            Enrollment.find({
                userId,
                $or: [{ paymentMethod: 'payos' }, { orderCode: { $exists: true, $ne: null } }],
            }).sort({ createdAt: -1 }).lean(),
            PracticeExercisePurchase.find({
                userId,
                $or: [{ paymentMethod: 'payos' }, { orderCode: { $exists: true, $ne: null } }],
            }).sort({ createdAt: -1 }).lean(),
        ]);

        const payosTransactions = await buildPayosTransactions(enrollments, luyentapPurchases);

        const coinCreditTotal = coinTransactions
            .filter((t) => t.type === 'credit')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        const coinDebitTotal = coinTransactions
            .filter((t) => t.type === 'debit')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        const payosCompleted = payosTransactions.filter((t) => t.status === 'completed');

        return {
            coinTransactions: coinTransactions.map((t) => mapCoinRow(t)),
            payosTransactions: payosTransactions.map(({ user, ...rest }) => rest),
            stats: {
                coinsBalance: user?.coins ?? 0,
                coinCreditTotal,
                coinDebitTotal,
                payosCompletedTotal: payosCompleted.reduce((sum, t) => sum + (t.amount || 0), 0),
                payosCompletedCount: payosCompleted.length,
            },
        };
    }

    async getAdminHistory(query = {}) {
        const type = query.type === 'payos' ? 'payos' : 'xu';
        const page = Math.max(parseInt(query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);
        const search = (query.search || '').trim();

        const stats = await this.getPlatformStats();

        if (type === 'xu') {
            const filter = {};
            if (search) {
                const userIds = await findUserIdsBySearch(search);
                const or = [{ reason: { $regex: search, $options: 'i' } }];
                if (userIds?.length) or.push({ userId: { $in: userIds } });
                filter.$or = or;
            }

            const [total, rows] = await Promise.all([
                CoinTransaction.countDocuments(filter),
                CoinTransaction.find(filter)
                    .populate('userId', 'fullName email username')
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean(),
            ]);

            return {
                type,
                items: rows.map((t) => mapCoinRow(t, t.userId)),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.max(1, Math.ceil(total / limit)),
                },
                stats,
            };
        }

        const [enrollments, luyentapPurchases] = await Promise.all([
            Enrollment.find({
                $or: [{ paymentMethod: 'payos' }, { orderCode: { $exists: true, $ne: null } }],
            }).sort({ createdAt: -1 }).lean(),
            PracticeExercisePurchase.find({
                $or: [{ paymentMethod: 'payos' }, { orderCode: { $exists: true, $ne: null } }],
            }).sort({ createdAt: -1 }).lean(),
        ]);

        const userIds = [...new Set([
            ...enrollments.map((e) => String(e.userId)),
            ...luyentapPurchases.map((p) => String(p.userId)),
        ].filter(Boolean))];

        const users = userIds.length
            ? await User.find({ _id: { $in: userIds } }).select('fullName email username').lean()
            : [];
        const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));
        let payosTransactions = await buildPayosTransactions(enrollments, luyentapPurchases, userMap);

        if (search) {
            const q = search.toLowerCase();
            payosTransactions = payosTransactions.filter((row) => {
                const userText = `${row.user?.fullName || ''} ${row.user?.email || ''} ${row.user?.username || ''}`.toLowerCase();
                return row.title.toLowerCase().includes(q)
                    || row.orderCode.toLowerCase().includes(q)
                    || userText.includes(q)
                    || (row.category === 'course' ? 'khóa học' : 'luyện tập').includes(q);
            });
        }

        const { items, pagination } = paginateItems(payosTransactions, page, limit);

        return {
            type,
            items,
            pagination,
            stats,
        };
    }
}

module.exports = new TransactionService();
