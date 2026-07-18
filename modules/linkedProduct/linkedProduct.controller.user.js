const linkedProductService = require('./linkedProduct.service.user');

module.exports = {
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
};
