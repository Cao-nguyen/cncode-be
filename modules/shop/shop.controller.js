const shopService = require('./shop.service');

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return String(forwarded).split(',')[0].trim();
    }
    return req.headers['cf-connecting-ip'] || req.ip || req.connection?.remoteAddress || null;
}

class ShopController {
    async createProduct(req, res) {
        try {
            const {
                title,
                description,
                price,
                category,
                images,
                files,
                preview,
                coverImage,
                discountType,
                discountValue,
                allowCoinPayment,
            } = req.body;
            const seller = req.userId;

            if (!title?.trim() || !description?.trim() || price === undefined || price === null || !category) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
                });
            }

            const result = await shopService.createProduct({
                title,
                description,
                price: Number(price),
                category,
                images: images || [],
                files: files || [],
                coverImage: coverImage || '',
                preview: preview?.url ? preview : undefined,
                discountType: discountType === 'vnd' ? 'vnd' : 'percent',
                discountValue: Number(discountValue) || 0,
                allowCoinPayment: allowCoinPayment !== false,
                seller,
            }, req.userRole);

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Error in createProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi tạo sản phẩm'
            });
        }
    }

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

            const result = await shopService.getProducts(filters, {
                userId: req.userId || null,
                userRole: req.userRole || null,
            });
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getProducts:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy danh sách sản phẩm'
            });
        }
    }

    async getProduct(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId || null;
            const result = await shopService.getProductById(id, userId, req.userRole, getClientIp(req));
            return res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
            console.error('Error in getProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy thông tin sản phẩm'
            });
        }
    }

    async getProductBySlug(req, res) {
        try {
            const { slug } = req.params;
            const userId = req.userId || null;
            const result = await shopService.getProductBySlug(
                slug,
                userId,
                req.userRole || null,
                getClientIp(req),
            );
            return res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
            console.error('Error in getProductBySlug:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy thông tin sản phẩm'
            });
        }
    }

    async getMyProducts(req, res) {
        try {
            const result = await shopService.getUserProducts(req.userId, req.query);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getMyProducts:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy sản phẩm của bạn'
            });
        }
    }

    async getPurchaseStatus(req, res) {
        try {
            const result = await shopService.getPurchaseStatus(req.params.id, req.userId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getPurchaseStatus:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi kiểm tra trạng thái mua'
            });
        }
    }

    async purchaseProduct(req, res) {
        try {
            const result = await shopService.purchaseProduct(req.params.id, req.userId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in purchaseProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi mua sản phẩm'
            });
        }
    }

    async purchaseProductWithPayos(req, res) {
        try {
            const result = await shopService.createPayOSPurchase(req.params.id, req.userId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in purchaseProductWithPayos:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi tạo thanh toán',
            });
        }
    }

    async updateProduct(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const result = await shopService.updateProduct(id, updateData, req.userId, req.userRole);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in updateProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi cập nhật sản phẩm'
            });
        }
    }

    async deleteProduct(req, res) {
        try {
            const { id } = req.params;
            const result = await shopService.deleteProduct(id, req.userId, req.userRole);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in deleteProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi xóa sản phẩm'
            });
        }
    }

    async approveProduct(req, res) {
        try {
            if (req.userRole !== 'admin') {
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

    async rejectProduct(req, res) {
        try {
            if (req.userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Chỉ admin mới có quyền từ chối sản phẩm'
                });
            }

            const { id } = req.params;
            const { reason } = req.body;

            if (!reason?.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng nhập lý do từ chối'
                });
            }

            const result = await shopService.rejectProduct(id, reason.trim());
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in rejectProduct:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi từ chối sản phẩm'
            });
        }
    }

    async getStats(req, res) {
        try {
            if (req.userRole !== 'admin') {
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

    async getProductReviews(req, res) {
        try {
            const { id } = req.params;
            const result = await shopService.getProductReviews(id, {
                page: req.query.page,
                limit: req.query.limit,
            });
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getProductReviews:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy đánh giá',
            });
        }
    }

    async getMyProductReview(req, res) {
        try {
            const { id } = req.params;
            const result = await shopService.getMyProductReview(id, req.userId || null);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getMyProductReview:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy đánh giá của bạn',
            });
        }
    }

    async createProductReview(req, res) {
        try {
            const { id } = req.params;
            const { rating, content } = req.body || {};
            const result = await shopService.createProductReview(id, req.userId, { rating, content });
            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Error in createProductReview:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi gửi đánh giá',
            });
        }
    }

    async updateProductReview(req, res) {
        try {
            const { id, reviewId } = req.params;
            const { rating, content } = req.body || {};
            const result = await shopService.updateProductReview(id, req.userId, reviewId, { rating, content });
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in updateProductReview:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi cập nhật đánh giá',
            });
        }
    }

    async deleteProductReview(req, res) {
        try {
            const { id, reviewId } = req.params;
            const result = await shopService.deleteProductReview(id, req.userId, reviewId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in deleteProductReview:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi xóa đánh giá',
            });
        }
    }

    async recordProductDownload(req, res) {
        try {
            const { id } = req.params;
            const { fileIndex } = req.body || {};
            const result = await shopService.recordProductDownload(id, req.userId, fileIndex);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in recordProductDownload:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi ghi nhận lượt tải',
            });
        }
    }
}

module.exports = new ShopController();
