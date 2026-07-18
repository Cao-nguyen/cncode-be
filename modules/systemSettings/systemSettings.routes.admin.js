const router = require('express').Router();
const controller = require('./systemSettings.controller.admin');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

router.use(authenticate);
router.use(requireAdmin);

router.get('/settings', controller.getSettings);
router.put('/settings/gioi-thieu', controller.updateGioiThieu);
router.put('/settings/dieu-khoan-su-dung', controller.updateDieuKhoanSuDung);
router.put('/settings/an-toan-bao-mat', controller.updateAnToanBaoMat);
router.put('/settings/quy-trinh-su-dung', controller.updateQuyTrinhSuDung);
router.put('/settings/huong-dan-thanh-toan', controller.updateHuongDanThanhToan);
router.put('/settings/chinh-sach-bao-hanh', controller.updateChinhSachBaoHanh);
router.get('/settings/history', controller.getHistory);

module.exports = router;
