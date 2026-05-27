
const LinkedProduct = require('./linkedProduct.model');

class LinkedProductService {
    
    async createProduct(userId, data) {
        const product = new LinkedProduct({
            userId,
            name: data.name,
            thumbnailUrl: data.thumbnailUrl || '',
            productUrl: data.productUrl,
        });
        await product.save();
        return product;
    }

    async getUserProducts(userId, { page = 1, limit = 20, status = 'all' }) {
        const query = { userId, status: { $ne: 'deleted' } };
        if (status !== 'all') {
            query.status = status;
        }

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            LinkedProduct.find(query)
                .sort({ sortOrder: 1, createdAt: -1 })
                .skip(skip)
                .limit(limit),
            LinkedProduct.countDocuments(query),
        ]);

        return {
            products,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getPublicProducts() {
        const products = await LinkedProduct.find({ status: 'active' })
            .sort({ sortOrder: 1, createdAt: -1 });
        return products;
    }

    async getProductById(productId) {
        const product = await LinkedProduct.findOne({
            _id: productId,
            status: { $ne: 'deleted' },
        });
        if (!product) {
            throw new Error('Không tìm thấy sản phẩm');
        }
        return product;
    }

    async updateProduct(productId, userId, data) {
        const product = await LinkedProduct.findOne({ _id: productId, userId });
        if (!product) {
            throw new Error('Không tìm thấy sản phẩm hoặc bạn không có quyền');
        }

        if (data.name !== undefined) product.name = data.name;
        if (data.thumbnailUrl !== undefined) product.thumbnailUrl = data.thumbnailUrl;
        if (data.productUrl !== undefined) product.productUrl = data.productUrl;
        if (data.status !== undefined) product.status = data.status;
        if (data.sortOrder !== undefined) product.sortOrder = data.sortOrder;

        await product.save();
        return product;
    }

    async deleteProduct(productId, userId) {
        const product = await LinkedProduct.findOne({ _id: productId, userId });
        if (!product) {
            throw new Error('Không tìm thấy sản phẩm hoặc bạn không có quyền');
        }

        product.status = 'deleted';
        await product.save();
        return product;
    }

    async updateSortOrder(userId, updates) {
        const bulkOps = updates.map(({ id, sortOrder }) => ({
            updateOne: {
                filter: { _id: id, userId },
                update: { sortOrder },
            },
        }));
        await LinkedProduct.bulkWrite(bulkOps);
    }
}

module.exports = new LinkedProductService();
