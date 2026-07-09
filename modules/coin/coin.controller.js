const coinService = require('./coin.service');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class CoinController {
    async create(req, res) {
        try {
            const transaction = await coinService.createTransaction({
                ...req.body,
                userId: req.userId
            });
            return successResponse(res, 201, 'Transaction created', transaction);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to create transaction', err);
        }
    }

    async getUserTransactions(req, res) {
        try {
            const transactions = await coinService.getUserTransactions(req.userId);
            return successResponse(res, 200, 'Transactions retrieved', transactions);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve transactions', err);
        }
    }

    async getById(req, res) {
        try {
            const transaction = await coinService.getTransactionById(req.params.id);
            if (!transaction) return errorResponse(res, 404, 'Transaction not found');
            return successResponse(res, 200, 'Transaction retrieved', transaction);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to retrieve transaction', err);
        }
    }
}

module.exports = new CoinController();
