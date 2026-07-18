const SystemSettings = require('./systemSettings.model');

class SystemSettingsServiceUser {
    async getPublicContent(slug) {
        const settings = await SystemSettings.findOne();
        if (!settings) {
            return {
                title: '',
                content: '',
                slug
            };
        }

        const fieldMap = {
            'gioi-thieu': 'gioiThieu',
            'dieu-khoan-su-dung': 'dieuKhoanSuDung',
            'an-toan-bao-mat': 'anToanBaoMat',
            'quy-trinh-su-dung': 'quyTrinhSuDung',
            'huong-dan-thanh-toan': 'huongDanThanhToan',
            'chinh-sach-bao-hanh': 'chinhSachBaoHanh'
        };

        const field = fieldMap[slug];
        if (!field) {
            return {
                title: '',
                content: '',
                slug
            };
        }

        const titleMap = {
            'gioi-thieu': 'Giới thiệu',
            'dieu-khoan-su-dung': 'Điều khoản sử dụng',
            'an-toan-bao-mat': 'An toàn bảo mật',
            'quy-trinh-su-dung': 'Quy trình sử dụng',
            'huong-dan-thanh-toan': 'Hướng dẫn thanh toán',
            'chinh-sach-bao-hanh': 'Chính sách bảo hành'
        };

        return {
            title: titleMap[slug] || '',
            content: settings[field] || '',
            slug
        };
    }
}

module.exports = new SystemSettingsServiceUser();
