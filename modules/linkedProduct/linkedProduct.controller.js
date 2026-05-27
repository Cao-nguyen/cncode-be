
const linkedProductService = require('./linkedProduct.service');

module.exports = {
    
    async create(req, res) {
        try {
            console.log('req.userId:', req.userId); 

            if (!req.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }

            const { name, thumbnailUrl, productUrl } = req.body;

            if (!name || !productUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Tên sản phẩm và URL là bắt buộc',
                });
            }

            const product = await linkedProductService.createProduct(req.userId, {
                name,
                thumbnailUrl: thumbnailUrl || '',
                productUrl,
            });

            res.status(201).json({
                success: true,
                data: product,
            });
        } catch (error) {
            console.error('Create product error:', error);
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    },

    async getUserProducts(req, res) {
        try {
            console.log('req.userId:', req.userId); 

            if (!req.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }

            const { page, limit, status } = req.query;
            const result = await linkedProductService.getUserProducts(req.userId, {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 20,
                status,
            });

            res.json({
                success: true,
                ...result,
            });
        } catch (error) {
            console.error('Get user products error:', error);
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    },

    async getPublicProducts(req, res) {
        try {
            const products = await linkedProductService.getPublicProducts();
            res.json({
                success: true,
                products,
            });
        } catch (error) {
            console.error('Get public products error:', error);
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    },

    async getById(req, res) {
        try {
            const product = await linkedProductService.getProductById(req.params.id);
            res.json({
                success: true,
                data: product,
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
        }
    },

    async update(req, res) {
        try {
            if (!req.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }

            const { name, thumbnailUrl, productUrl, status, sortOrder } = req.body;
            const updateData = {};

            if (name !== undefined) updateData.name = name;
            if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
            if (productUrl !== undefined) updateData.productUrl = productUrl;
            if (status !== undefined) updateData.status = status;
            if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

            const product = await linkedProductService.updateProduct(
                req.params.id,
                req.userId,
                updateData
            );

            res.json({
                success: true,
                data: product,
            });
        } catch (error) {
            console.error('Update product error:', error);
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    },

    async delete(req, res) {
        try {
            if (!req.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }

            await linkedProductService.deleteProduct(req.params.id, req.userId);
            res.json({
                success: true,
                message: 'Xóa sản phẩm thành công',
            });
        } catch (error) {
            console.error('Delete product error:', error);
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    },

    async updateSortOrder(req, res) {
        try {
            if (!req.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }

            const { updates } = req.body;

            if (!updates || !Array.isArray(updates)) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu dữ liệu updates',
                });
            }

            await linkedProductService.updateSortOrder(req.userId, updates);
            res.json({
                success: true,
                message: 'Cập nhật thứ tự thành công',
            });
        } catch (error) {
            console.error('Update sort order error:', error);
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    },
};
