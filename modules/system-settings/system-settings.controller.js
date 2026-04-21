// modules/system-settings/system-settings.controller.js
const systemSettingsService = require('./system-settings.service');

// Lấy tất cả settings
const getSettings = async (req, res) => {
    try {
        const settings = await systemSettingsService.getSettings();

        res.status(200).json({
            success: true,
            data: settings,
            message: 'Lấy cài đặt thành công'
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cập nhật chính sách bảo hành
const updateChinhSachBaoHanh = async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.userId;

        const settings = await systemSettingsService.updateField('chinhSachBaoHanh', content, userId);

        res.status(200).json({
            success: true,
            data: settings,
            message: 'Cập nhật chính sách bảo hành thành công'
        });
    } catch (error) {
        console.error('Update chinh sach bao hanh error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cập nhật hướng dẫn thanh toán
const updateHuongDanThanhToan = async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.userId;

        const settings = await systemSettingsService.updateField('huongDanThanhToan', content, userId);

        res.status(200).json({
            success: true,
            data: settings,
            message: 'Cập nhật hướng dẫn thanh toán thành công'
        });
    } catch (error) {
        console.error('Update huong dan thanh toan error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cập nhật quy trình sử dụng
const updateQuyTrinhSuDung = async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.userId;

        const settings = await systemSettingsService.updateField('quyTrinhSuDung', content, userId);

        res.status(200).json({
            success: true,
            data: settings,
            message: 'Cập nhật quy trình sử dụng thành công'
        });
    } catch (error) {
        console.error('Update quy trinh su dung error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cập nhật giới thiệu
const updateGioiThieu = async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.userId;

        const settings = await systemSettingsService.updateField('gioiThieu', content, userId);

        res.status(200).json({
            success: true,
            data: settings,
            message: 'Cập nhật giới thiệu thành công'
        });
    } catch (error) {
        console.error('Update gioi thieu error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cập nhật an toàn bảo mật
const updateAnToanBaoMat = async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.userId;

        const settings = await systemSettingsService.updateField('anToanBaoMat', content, userId);

        res.status(200).json({
            success: true,
            data: settings,
            message: 'Cập nhật an toàn bảo mật thành công'
        });
    } catch (error) {
        console.error('Update an toan bao mat error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cập nhật điều khoản sử dụng
const updateDieuKhoanSuDung = async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.userId;

        const settings = await systemSettingsService.updateField('dieuKhoanSuDung', content, userId);

        res.status(200).json({
            success: true,
            data: settings,
            message: 'Cập nhật điều khoản sử dụng thành công'
        });
    } catch (error) {
        console.error('Update dieu khoan su dung error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Lấy lịch sử cập nhật
const getHistory = async (req, res) => {
    try {
        const { field } = req.query;

        if (!field) {
            const settings = await systemSettingsService.getSettings();
            return res.status(200).json({
                success: true,
                data: settings?.updateHistory || [],
                message: 'Lấy lịch sử thành công'
            });
        }

        const history = await systemSettingsService.getFieldHistory(field);

        res.status(200).json({
            success: true,
            data: history,
            message: 'Lấy lịch sử thành công'
        });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Public: Lấy nội dung theo slug
const getPublicContent = async (req, res) => {
    try {
        const { slug } = req.params;

        let content = '';
        let title = '';

        switch (slug) {
            case 'chinhsachbaohanh':
                content = await systemSettingsService.getContentByField('chinhSachBaoHanh');
                title = 'Chính sách bảo hành';
                break;
            case 'huongdanthanhtoan':
                content = await systemSettingsService.getContentByField('huongDanThanhToan');
                title = 'Hướng dẫn thanh toán';
                break;
            case 'quytrinhsudung':
                content = await systemSettingsService.getContentByField('quyTrinhSuDung');
                title = 'Quy trình sử dụng dịch vụ';
                break;
            case 'gioithieu':
                content = await systemSettingsService.getContentByField('gioiThieu');
                title = 'Giới thiệu về CNcode';
                break;
            case 'antoanbaomat':
                content = await systemSettingsService.getContentByField('anToanBaoMat');
                title = 'An toàn & bảo mật';
                break;
            case 'dieukhoansudung':
                content = await systemSettingsService.getContentByField('dieuKhoanSuDung');
                title = 'Điều khoản sử dụng';
                break;
            default:
                return res.status(404).json({ success: false, message: 'Không tìm thấy trang' });
        }

        res.status(200).json({
            success: true,
            data: {
                title,
                content,
                slug
            },
            message: 'Lấy nội dung thành công'
        });
    } catch (error) {
        console.error('Get public content error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getSettings,
    updateChinhSachBaoHanh,
    updateHuongDanThanhToan,
    updateQuyTrinhSuDung,
    updateGioiThieu,
    updateAnToanBaoMat,
    updateDieuKhoanSuDung,
    getHistory,
    getPublicContent
};