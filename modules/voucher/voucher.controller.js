// modules/voucher/voucher.controller.js
const voucherService = require('./voucher.service');

class VoucherController {
    // ============ USER CONTROLLER ============

    async getUserVouchers(req, res) {
        try {
            const { status } = req.query;
            const vouchers = await voucherService.getUserVouchers(req.userId, status);
            res.json({ success: true, data: vouchers });
        } catch (error) {
            console.error('Get user vouchers error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async applyVoucher(req, res) {
        try {
            const { code, orderTotal } = req.body;
            const result = await voucherService.applyVoucher(req.userId, code, orderTotal);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    // ============ ADMIN CONTROLLER ============

    async getAllVouchers(req, res) {
        try {
            const { status, search } = req.query;
            const vouchers = await voucherService.getAllVouchers({ status, search });
            res.json({ success: true, data: vouchers });
        } catch (error) {
            console.error('Get all vouchers error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getVoucherById(req, res) {
        try {
            const { id } = req.params;
            const voucher = await voucherService.getVoucherById(id);
            res.json({ success: true, data: voucher });
        } catch (error) {
            res.status(404).json({ success: false, message: error.message });
        }
    }

    async createVoucher(req, res) {
        try {
            const voucher = await voucherService.createVoucher(req.userId, req.body);
            res.status(201).json({ success: true, data: voucher });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async updateVoucher(req, res) {
        try {
            const { id } = req.params;
            const voucher = await voucherService.updateVoucher(id, req.body);
            res.json({ success: true, data: voucher });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async deleteVoucher(req, res) {
        try {
            const { id } = req.params;
            await voucherService.deleteVoucher(id);
            res.json({ success: true, message: 'Xóa voucher thành công' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async assignVoucherToUsers(req, res) {
        try {
            const { voucherId, userIds } = req.body;
            const count = await voucherService.assignVoucherToUsers(voucherId, userIds);
            res.json({ success: true, message: `Đã gán voucher cho ${count} người dùng` });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getAssignableUsers(req, res) {
        try {
            const { search } = req.query;
            const users = await voucherService.getAssignableUsers(search);
            res.json({ success: true, data: users });
        } catch (error) {
            console.error('Get assignable users error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new VoucherController();