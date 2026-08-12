const FIELD_SLUG_MAP = {
    'gioi-thieu': 'gioiThieu',
    'dieu-khoan-su-dung': 'dieuKhoanSuDung',
    'an-toan-bao-mat': 'anToanBaoMat',
    'quy-trinh-su-dung': 'quyTrinhSuDung',
    'huong-dan-thanh-toan': 'huongDanThanhToan',
    'chinh-sach-bao-hanh': 'chinhSachBaoHanh',
};

const FIELD_TITLE_MAP = {
    'gioi-thieu': 'Giới thiệu',
    'dieu-khoan-su-dung': 'Điều khoản sử dụng',
    'an-toan-bao-mat': 'An toàn bảo mật',
    'quy-trinh-su-dung': 'Quy trình sử dụng',
    'huong-dan-thanh-toan': 'Hướng dẫn thanh toán',
    'chinh-sach-bao-hanh': 'Chính sách bảo hành',
};

const VALID_FIELDS = Object.values(FIELD_SLUG_MAP);

function slugToField(slug) {
    return FIELD_SLUG_MAP[slug] || null;
}

module.exports = {
    FIELD_SLUG_MAP,
    FIELD_TITLE_MAP,
    VALID_FIELDS,
    slugToField,
};
