// modules/activity/activity.service.js
const mongoose = require('mongoose');
const User = require('../user/user.model');
const Post = require('../post/post.model');
const DigitalProduct = require('../digital-product/digital-product.model');
const Payment = require('../payment/payment.model');

class ActivityService {
    async getAllActivities(filters = {}, page = 1, limit = 20) {
        const { type, userId, startDate, endDate, search, status } = filters;
        const skip = (page - 1) * limit;

        let allActivities = [];

        // 1. Lấy bài viết - KHÔNG hiển thị mô tả
        if (!type || type === 'post') {
            const postsQuery = {};
            if (userId) postsQuery.author = new mongoose.Types.ObjectId(userId);
            if (startDate || endDate) {
                postsQuery.createdAt = {};
                if (startDate) postsQuery.createdAt.$gte = new Date(startDate);
                if (endDate) postsQuery.createdAt.$lte = new Date(endDate);
            }
            if (status) postsQuery.status = status;

            const posts = await Post.find(postsQuery)
                .sort({ createdAt: -1 })
                .populate('author', 'fullName email avatar')
                .lean();

            posts.forEach(post => {
                if (search && !post.title.toLowerCase().includes(search.toLowerCase())) return;
                allActivities.push({
                    id: post._id,
                    type: 'post',
                    action: 'created_post',
                    title: post.title,
                    // Không có description
                    status: post.status,
                    user: post.author,
                    metadata: {
                        views: post.views,
                        likes: post.likes,
                        comments: post.comments?.length || 0,
                        slug: post.slug
                    },
                    createdAt: post.createdAt,
                    link: `/blog/${post.slug}`
                });
            });
        }

        // 2. Lấy sản phẩm - KHÔNG hiển thị mô tả
        if (!type || type === 'product') {
            const productsQuery = {};
            if (userId) productsQuery.author = new mongoose.Types.ObjectId(userId);
            if (startDate || endDate) {
                productsQuery.createdAt = {};
                if (startDate) productsQuery.createdAt.$gte = new Date(startDate);
                if (endDate) productsQuery.createdAt.$lte = new Date(endDate);
            }
            if (status) productsQuery.status = status;

            const products = await DigitalProduct.find(productsQuery)
                .sort({ createdAt: -1 })
                .populate('author', 'fullName email avatar')
                .lean();

            products.forEach(product => {
                if (search && !product.name.toLowerCase().includes(search.toLowerCase())) return;
                allActivities.push({
                    id: product._id,
                    type: 'product',
                    action: 'created_product',
                    title: product.name,
                    // Không có description
                    status: product.status,
                    user: product.author,
                    metadata: {
                        price: product.price,
                        downloads: product.downloadCount,
                        rating: product.rating,
                        slug: product.slug
                    },
                    createdAt: product.createdAt,
                    link: `/cuahangso/${product.slug}`
                });
            });
        }

        // 3. Lấy giao dịch thanh toán - HIỂN THỊ RÕ XU hay NGÂN HÀNG
        if (!type || type === 'payment') {
            const paymentsQuery = {
                status: 'success'
            };
            if (userId) paymentsQuery.user = new mongoose.Types.ObjectId(userId);
            if (startDate || endDate) {
                paymentsQuery.createdAt = {};
                if (startDate) paymentsQuery.createdAt.$gte = new Date(startDate);
                if (endDate) paymentsQuery.createdAt.$lte = new Date(endDate);
            }

            const payments = await Payment.find(paymentsQuery)
                .sort({ createdAt: -1 })
                .populate('user', 'fullName email avatar')
                .populate('product', 'name slug')
                .lean();

            payments.forEach(payment => {
                if (search && !payment.product?.name.toLowerCase().includes(search.toLowerCase())) return;

                // Xác định phương thức thanh toán và số tiền/xu
                const isXuPayment = payment.paymentMethod === 'xu';
                const methodText = isXuPayment ? 'Xu' : 'Ngân hàng (PayOS)';
                const amountText = isXuPayment
                    ? `${payment.xuAmount?.toLocaleString() || 0} Xu`
                    : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payment.amount);

                allActivities.push({
                    id: payment._id,
                    type: 'payment',
                    action: 'purchased',
                    title: `Mua sản phẩm: ${payment.product?.name || 'Unknown'}`,
                    status: payment.status,
                    user: payment.user,
                    metadata: {
                        amount: payment.amount,
                        xuAmount: payment.xuAmount || 0,
                        method: payment.paymentMethod,
                        methodText: methodText,
                        amountText: amountText,
                        productId: payment.product?._id,
                        productSlug: payment.product?.slug
                    },
                    createdAt: payment.createdAt,
                    link: `/cuahangso/${payment.product?.slug}`
                });
            });
        }

        // Sắp xếp theo thời gian giảm dần
        const sorted = allActivities.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const total = sorted.length;
        const paginated = sorted.slice(skip, skip + limit);

        return {
            activities: paginated,
            total,
            totalPages: Math.ceil(total / limit)
        };
    }

    async getActivityStats() {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 7);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            totalPosts,
            newPostsToday,
            newPostsThisWeek,
            newPostsThisMonth,
            totalProducts,
            newProductsToday,
            newProductsThisWeek,
            newProductsThisMonth,
            totalPayments,
            newPaymentsToday,
            newPaymentsThisWeek,
            newPaymentsThisMonth,
            totalRevenue
        ] = await Promise.all([
            Post.countDocuments(),
            Post.countDocuments({ createdAt: { $gte: startOfToday } }),
            Post.countDocuments({ createdAt: { $gte: startOfWeek } }),
            Post.countDocuments({ createdAt: { $gte: startOfMonth } }),
            DigitalProduct.countDocuments(),
            DigitalProduct.countDocuments({ createdAt: { $gte: startOfToday } }),
            DigitalProduct.countDocuments({ createdAt: { $gte: startOfWeek } }),
            DigitalProduct.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Payment.countDocuments({ status: 'success' }),
            Payment.countDocuments({ status: 'success', createdAt: { $gte: startOfToday } }),
            Payment.countDocuments({ status: 'success', createdAt: { $gte: startOfWeek } }),
            Payment.countDocuments({ status: 'success', createdAt: { $gte: startOfMonth } }),
            Payment.aggregate([
                { $match: { status: 'success', paymentMethod: 'banking' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        // Thống kê thanh toán theo phương thức
        const paymentMethodStats = await Payment.aggregate([
            { $match: { status: 'success' } },
            {
                $group: {
                    _id: '$paymentMethod',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                    totalXu: { $sum: '$xuAmount' }
                }
            }
        ]);

        return {
            posts: {
                total: totalPosts,
                today: newPostsToday,
                thisWeek: newPostsThisWeek,
                thisMonth: newPostsThisMonth
            },
            products: {
                total: totalProducts,
                today: newProductsToday,
                thisWeek: newProductsThisWeek,
                thisMonth: newProductsThisMonth
            },
            payments: {
                total: totalPayments,
                today: newPaymentsToday,
                thisWeek: newPaymentsThisWeek,
                thisMonth: newPaymentsThisMonth,
                totalRevenue: totalRevenue[0]?.total || 0,
                byMethod: paymentMethodStats
            }
        };
    }
}

module.exports = new ActivityService();