// modules/system-settings/system-settings.model.js
const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    // Các trang nội dung
    chinhSachBaoHanh: {
        type: String,
        default: ''
    },
    huongDanThanhToan: {
        type: String,
        default: ''
    },
    quyTrinhSuDung: {
        type: String,
        default: ''
    },
    gioiThieu: {
        type: String,
        default: ''
    },
    anToanBaoMat: {
        type: String,
        default: ''
    },
    dieuKhoanSuDung: {
        type: String,
        default: ''
    },
    // Thông tin cập nhật
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Lịch sử cập nhật
    updateHistory: [{
        field: String,
        oldValue: String,
        newValue: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updatedAt: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);