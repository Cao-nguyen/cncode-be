const LinkedProduct = require('./linkedProduct.model');

class LinkedProductServiceUser {
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
}

module.exports = new LinkedProductServiceUser();
