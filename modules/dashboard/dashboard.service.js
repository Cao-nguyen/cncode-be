// modules/dashboard/dashboard.service.js
const mongoose = require('mongoose');
const User = require('../user/user.model');
const DigitalProduct = require('../digital-product/digital-product.model');
const Payment = require('../payment/payment.model');
const Post = require('../post/post.model');

class DashboardService {

    // Dành cho Admin - Thống kê toàn hệ thống
    async getAdminDashboard() {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 7);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        // 1. Thống kê người dùng
        const [
            totalUsers,
            newUsersToday,
            newUsersThisWeek,
            newUsersThisMonth,
            newUsersThisYear,
            totalTeachers,
            activeUsersToday
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: startOfToday } }),
            User.countDocuments({ createdAt: { $gte: startOfWeek } }),
            User.countDocuments({ createdAt: { $gte: startOfMonth } }),
            User.countDocuments({ createdAt: { $gte: startOfYear } }),
            User.countDocuments({ role: 'teacher' }),
            User.countDocuments({ lastActiveAt: { $gte: startOfToday } })
        ]);

        // 2. Thống kê nội dung
        const [
            totalProducts,
            newProductsThisMonth,
            totalPosts,
            newPostsThisMonth,
            totalPublishedProducts,
            totalPublishedPosts
        ] = await Promise.all([
            DigitalProduct.countDocuments(),
            DigitalProduct.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Post.countDocuments(),
            Post.countDocuments({ createdAt: { $gte: startOfMonth } }),
            DigitalProduct.countDocuments({ status: 'published' }),
            Post.countDocuments({ status: 'published' })
        ]);

        // 3. Thống kê doanh thu & giao dịch - CHỈ TÍNH PAYOS (banking), KHÔNG TÍNH XU
        const [
            totalRevenue,
            revenueThisMonth,
            totalOrders,
            ordersThisMonth,
            xuSpentThisMonth
        ] = await Promise.all([
            // Tổng doanh thu từ PayOS (banking)
            Payment.aggregate([
                {
                    $match: {
                        status: 'success',
                        paymentMethod: 'banking'  // Chỉ lấy thanh toán qua PayOS
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            // Doanh thu tháng này từ PayOS
            Payment.aggregate([
                {
                    $match: {
                        status: 'success',
                        paymentMethod: 'banking',  // Chỉ lấy thanh toán qua PayOS
                        createdAt: { $gte: startOfMonth }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            // Tổng số đơn hàng thành công từ PayOS
            Payment.countDocuments({
                status: 'success',
                paymentMethod: 'banking'
            }),
            // Số đơn hàng tháng này từ PayOS
            Payment.countDocuments({
                status: 'success',
                paymentMethod: 'banking',
                createdAt: { $gte: startOfMonth }
            }),
            // Xu tiêu thụ trong tháng (vẫn giữ để hiển thị riêng)
            Payment.aggregate([
                {
                    $match: {
                        status: 'success',
                        paymentMethod: 'xu',
                        createdAt: { $gte: startOfMonth }
                    }
                },
                { $group: { _id: null, total: { $sum: '$xuAmount' } } }
            ])
        ]);

        // 4. Biểu đồ doanh thu 12 tháng - CHỈ TÍNH PAYOS
        const revenueChart = await this.getRevenueChart(12);

        // 5. Biểu đồ người dùng mới 12 tháng
        const userGrowthChart = await this.getUserGrowthChart(12);

        // 6. Biểu đồ nội dung 12 tháng
        const contentChart = await this.getContentChart(12);

        // 7. Top sản phẩm bán chạy (dựa trên downloadCount)
        const topProducts = await DigitalProduct.find({ status: 'published' })
            .sort({ downloadCount: -1 })
            .limit(10)
            .select('name thumbnail downloadCount price rating')
            .lean();

        // 8. Top bài viết nổi bật
        const topPosts = await Post.find({ status: 'published' })
            .sort({ views: -1 })
            .limit(10)
            .select('title slug thumbnail views likes comments')
            .populate('author', 'fullName')
            .lean();

        // 9. Thống kê theo danh mục
        const categoryStats = await DigitalProduct.aggregate([
            { $match: { status: 'published' } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    totalDownloads: { $sum: '$downloadCount' },
                    avgRating: { $avg: '$rating' }
                }
            }
        ]);

        return {
            overview: {
                users: {
                    total: totalUsers,
                    today: newUsersToday,
                    thisWeek: newUsersThisWeek,
                    thisMonth: newUsersThisMonth,
                    thisYear: newUsersThisYear,
                    teachers: totalTeachers,
                    activeToday: activeUsersToday
                },
                content: {
                    products: {
                        total: totalProducts,
                        published: totalPublishedProducts,
                        newThisMonth: newProductsThisMonth
                    },
                    posts: {
                        total: totalPosts,
                        published: totalPublishedPosts,
                        newThisMonth: newPostsThisMonth
                    }
                },
                revenue: {
                    total: totalRevenue[0]?.total || 0,
                    thisMonth: revenueThisMonth[0]?.total || 0,
                    totalOrders: totalOrders,
                    ordersThisMonth: ordersThisMonth,
                    xuSpentThisMonth: xuSpentThisMonth[0]?.total || 0
                }
            },
            charts: {
                revenue: revenueChart,
                userGrowth: userGrowthChart,
                content: contentChart
            },
            topProducts,
            topPosts,
            categoryStats
        };
    }

    // Biểu đồ doanh thu theo tháng - CHỈ TÍNH PAYOS (banking)
    async getRevenueChart(months = 12) {
        const chartData = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

            // Chỉ tính doanh thu từ PayOS (banking)
            const revenue = await Payment.aggregate([
                {
                    $match: {
                        status: 'success',
                        paymentMethod: 'banking',  // Chỉ lấy thanh toán qua PayOS
                        createdAt: { $gte: date, $lt: nextDate }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            // Chỉ tính số đơn hàng từ PayOS
            const orders = await Payment.countDocuments({
                status: 'success',
                paymentMethod: 'banking',
                createdAt: { $gte: date, $lt: nextDate }
            });

            chartData.push({
                month: `${date.getMonth() + 1}/${date.getFullYear()}`,
                revenue: revenue[0]?.total || 0,
                orders: orders
            });
        }

        return chartData;
    }

    // Biểu đồ người dùng mới theo tháng
    async getUserGrowthChart(months = 12) {
        const chartData = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

            const users = await User.countDocuments({
                createdAt: { $gte: date, $lt: nextDate }
            });

            const teachers = await User.countDocuments({
                role: 'teacher',
                createdAt: { $gte: date, $lt: nextDate }
            });

            chartData.push({
                month: `${date.getMonth() + 1}/${date.getFullYear()}`,
                users,
                teachers,
                total: users + teachers
            });
        }

        return chartData;
    }

    // Biểu đồ nội dung theo tháng
    async getContentChart(months = 12) {
        const chartData = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

            const [products, posts] = await Promise.all([
                DigitalProduct.countDocuments({
                    createdAt: { $gte: date, $lt: nextDate },
                    status: 'published'
                }),
                Post.countDocuments({
                    createdAt: { $gte: date, $lt: nextDate },
                    status: 'published'
                })
            ]);

            chartData.push({
                month: `${date.getMonth() + 1}/${date.getFullYear()}`,
                products,
                posts
            });
        }

        return chartData;
    }

    // Dành cho User - Dashboard cá nhân (giữ nguyên, có thể tính cả xu)
    async getUserDashboard(userId) {
        const user = await User.findById(userId).select('fullName email avatar coins streak role createdAt');

        const userPosts = await Post.aggregate([
            { $match: { author: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    totalViews: { $sum: '$views' },
                    totalLikes: { $sum: '$likes' },
                    published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } }
                }
            }
        ]);

        const userProducts = await DigitalProduct.aggregate([
            { $match: { author: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    totalDownloads: { $sum: '$downloadCount' },
                    published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } }
                }
            }
        ]);

        // User payments - có thể tính cả xu (vì là chi tiêu cá nhân)
        const userPayments = await Payment.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId), status: 'success' } },
            {
                $group: {
                    _id: null,
                    totalSpent: { $sum: '$amount' },
                    totalTransactions: { $sum: 1 }
                }
            }
        ]);

        return {
            user: {
                name: user?.fullName,
                email: user?.email,
                avatar: user?.avatar,
                coins: user?.coins || 0,
                streak: user?.streak || 0,
                joinedAt: user?.createdAt
            },
            stats: {
                posts: userPosts[0] || { total: 0, totalViews: 0, totalLikes: 0, published: 0 },
                products: userProducts[0] || { total: 0, totalDownloads: 0, published: 0 },
                payments: userPayments[0] || { totalSpent: 0, totalTransactions: 0 }
            }
        };
    }
}

module.exports = new DashboardService();