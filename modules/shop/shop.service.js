const Product = require('./shop.model');

class ShopService {
    // Create new product
    async createProduct(productData) {
        try {
            const product = new Product(productData);
            await product.save();
            return {
                success: true,
                data: product,
                message: 'Sản phẩm đã được tạo và đang chờ duyệt'
            };
        } catch (error) {
            console.error('Error creating product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi tạo sản phẩm'
            };
        }
    }

    // Get all products with filters
    async getProducts(filters = {}) {
        try {
            const {
                page = 1,
                limit = 12,
                category,
                status = 'approved',
                seller,
                search,
                featured,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const query = {};

            if (category) query.category = category;
            if (status) query.status = status;
            if (seller) query.seller = seller;
            if (featured !== undefined) query.featured = featured;
            if (search) {
                query.$text = { $search: search };
            }

            const skip = (page - 1) * limit;
            const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

            const [products, total] = await Promise.all([
                Product.find(query)
                    .populate('seller', 'fullName avatar email')
                    .sort(sort)
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                Product.countDocuments(query)
            ]);

            return {
                success: true,
                data: products,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit),
                    limit: parseInt(limit)
                }
            };
        } catch (error) {
            console.error('Error getting products:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi lấy danh sách sản phẩm'
            };
        }
    }

    // Get single product by ID
    async getProductById(productId) {
        try {
            const product = await Product.findById(productId)
                .populate('seller', 'fullName avatar email role');

            if (!product) {
                return {
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                };
            }

            // Increment view count
            product.views += 1;
            await product.save();

            return {
                success: true,
                data: product
            };
        } catch (error) {
            console.error('Error getting product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi lấy thông tin sản phẩm'
            };
        }
    }

    // Update product
    async updateProduct(productId, updateData, userId, userRole) {
        try {
            const product = await Product.findById(productId);

            if (!product) {
                return {
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                };
            }

            // Check permissions
            if (userRole !== 'admin' && product.seller.toString() !== userId) {
                return {
                    success: false,
                    message: 'Bạn không có quyền chỉnh sửa sản phẩm này'
                };
            }

            // Update fields
            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined) {
                    product[key] = updateData[key];
                }
            });

            await product.save();

            return {
                success: true,
                data: product,
                message: 'Cập nhật sản phẩm thành công'
            };
        } catch (error) {
            console.error('Error updating product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi cập nhật sản phẩm'
            };
        }
    }

    // Delete product
    async deleteProduct(productId, userId, userRole) {
        try {
            const product = await Product.findById(productId);

            if (!product) {
                return {
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                };
            }

            // Check permissions
            if (userRole !== 'admin' && product.seller.toString() !== userId) {
                return {
                    success: false,
                    message: 'Bạn không có quyền xóa sản phẩm này'
                };
            }

            await Product.findByIdAndDelete(productId);

            return {
                success: true,
                message: 'Xóa sản phẩm thành công'
            };
        } catch (error) {
            console.error('Error deleting product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi xóa sản phẩm'
            };
        }
    }

    // Approve product (admin only)
    async approveProduct(productId) {
        try {
            const product = await Product.findByIdAndUpdate(
                productId,
                { status: 'approved', rejectionReason: undefined },
                { new: true }
            ).populate('seller', 'fullName email');

            if (!product) {
                return {
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                };
            }

            return {
                success: true,
                data: product,
                message: 'Đã duyệt sản phẩm'
            };
        } catch (error) {
            console.error('Error approving product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi duyệt sản phẩm'
            };
        }
    }

    // Reject product (admin only)
    async rejectProduct(productId, reason) {
        try {
            const product = await Product.findByIdAndUpdate(
                productId,
                { status: 'rejected', rejectionReason: reason },
                { new: true }
            ).populate('seller', 'fullName email');

            if (!product) {
                return {
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                };
            }

            return {
                success: true,
                data: product,
                message: 'Đã từ chối sản phẩm'
            };
        } catch (error) {
            console.error('Error rejecting product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi từ chối sản phẩm'
            };
        }
    }

    // Get stats (admin only)
    async getStats() {
        try {
            const [
                totalProducts,
                pendingProducts,
                approvedProducts,
                rejectedProducts,
                totalViews,
                totalPurchases,
                categoryCounts
            ] = await Promise.all([
                Product.countDocuments(),
                Product.countDocuments({ status: 'pending' }),
                Product.countDocuments({ status: 'approved' }),
                Product.countDocuments({ status: 'rejected' }),
                Product.aggregate([
                    { $group: { _id: null, total: { $sum: '$views' } } }
                ]),
                Product.aggregate([
                    { $group: { _id: null, total: { $sum: '$purchases' } } }
                ]),
                Product.aggregate([
                    { $group: { _id: '$category', count: { $sum: 1 } } }
                ])
            ]);

            return {
                success: true,
                data: {
                    totalProducts,
                    pendingProducts,
                    approvedProducts,
                    rejectedProducts,
                    totalViews: totalViews[0]?.total || 0,
                    totalPurchases: totalPurchases[0]?.total || 0,
                    categoryCounts
                }
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi lấy thống kê'
            };
        }
    }
}

module.exports = new ShopService();