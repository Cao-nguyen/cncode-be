const transactionService = require('./transaction.service');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class TransactionController {
    async getMyHistory(req, res) {
        try {
            const data = await transactionService.getUserHistory(req.userId);
            return successResponse(res, 200, 'Lịch sử giao dịch', data);
        } catch (err) {
            console.error('getMyHistory error:', err);
            return errorResponse(res, 500, 'Không tải được lịch sử giao dịch', err);
        }
    }

    async getAdminHistory(req, res) {
        try {
            const data = await transactionService.getAdminHistory(req.query);
            return successResponse(res, 200, 'Lịch sử giao dịch admin', data);
        } catch (err) {
            console.error('getAdminHistory error:', err);
            return errorResponse(res, 500, 'Không tải được lịch sử giao dịch', err);
        }
    }
}

module.exports = new TransactionController();
