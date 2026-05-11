// modules/voucher/voucher.routes.js
const router = require('express').Router();
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const voucherController = require('./voucher.controller');

// ============ USER ROUTES ============
router.get('/user/vouchers', authenticate, voucherController.getUserVouchers);
router.post('/user/vouchers/apply', authenticate, voucherController.applyVoucher);

// ============ ADMIN ROUTES ============
router.get('/admin/vouchers',
    authenticate,
    authorize('admin'),
    voucherController.getAllVouchers
);

router.get('/admin/vouchers/:id',
    authenticate,
    authorize('admin'),
    voucherController.getVoucherById
);

router.post('/admin/vouchers',
    authenticate,
    authorize('admin'),
    voucherController.createVoucher
);

router.put('/admin/vouchers/:id',
    authenticate,
    authorize('admin'),
    voucherController.updateVoucher
);

router.delete('/admin/vouchers/:id',
    authenticate,
    authorize('admin'),
    voucherController.deleteVoucher
);

router.post('/admin/vouchers/assign',
    authenticate,
    authorize('admin'),
    voucherController.assignVoucherToUsers
);

router.get('/admin/users/assignable',
    authenticate,
    authorize('admin'),
    voucherController.getAssignableUsers
);

module.exports = router;