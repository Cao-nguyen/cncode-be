const shopService = require('./shop.service');

class ShopController {
    // Create product
    async createProduct(req, res) {
        try {
            const { title, description, price, category, images, files, tags } = req.body;
            const seller = req.user._id;

            if (!title || !description || !price || !category) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
                });
            }

            const result = await shopService.createProduct({
                title,
                description,
                price,
                category,
                images: images || [],
                files: files || [],
                tags: tags || [],
                seller
            });

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Error in createProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi tạo sản phẩm'
            });
        }
    }

    // Get all products
    async getProducts(req, res) {
        try {
            const filters = {
                page: req.query.page,
                limit: req.query.limit,
                category: req.query.category,
                status: req.query.status,
                seller: req.query.seller,
                search: req.query.search,
                featured: req.query.featured,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder
            };

            const result = await shopService.getProducts(filters);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getProducts:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy danh sách sản phẩm'
            });
        }
    }

    // Get single product
    async getProduct(req, res) {
        try {
            const { id } = req.params;
            const result = await shopService.getProductById(id);
            return res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
            console.error('Error in getProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy thông tin sản phẩm'
            });
        }
    }

    // Update product
    async updateProduct(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const userId = req.user._id;
            const userRole = req.user.role;

            const result = await shopService.updateProduct(id, updateData, userId, userRole);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in updateProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi cập nhật sản phẩm'
            });
        }
    }

    // Delete product
    async deleteProduct(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user._id;
            const userRole = req.user.role;

            const result = await shopService.deleteProduct(id, userId, userRole);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in deleteProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi xóa sản phẩm'
            });
        }
    }

    // Approve product (admin only)
    async approveProduct(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Chỉ admin mới có quyền duyệt sản phẩm'
                });
            }

            const { id } = req.params;
            const result = await shopService.approveProduct(id);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in approveProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi duyệt sản phẩm'
            });
        }
    }

    // Reject product (admin only)
    async rejectProduct(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Chỉ admin mới có quyền từ chối sản phẩm'
                });
            }

            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng nhập lý do từ chối'
                });
            }

            const result = await shopService.rejectProduct(id, reason);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in rejectProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi từ chối sản phẩm'
            });
        }
    }

    // Get stats (admin only)
    async getStats(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Chỉ admin mới có quyền xem thống kê'
                });
            }

            const result = await shopService.getStats();
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getStats:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy thống kê'
            });
        }
    }
}

module.exports = new ShopController();