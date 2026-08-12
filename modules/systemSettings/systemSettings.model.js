const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    gioiThieu: {
        type: String,
        default: '',
    },
    dieuKhoanSuDung: {
        type: String,
        default: '',
    },
    anToanBaoMat: {
        type: String,
        default: '',
    },
    quyTrinhSuDung: {
        type: String,
        default: '',
    },
    huongDanThanhToan: {
        type: String,
        default: '',
    },
    chinhSachBaoHanh: {
        type: String,
        default: '',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    updateHistory: [{
        field: String,
        oldValue: String,
        newValue: String,
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        updatedAt: Date,
    }],
}, { timestamps: true });

const SystemSettings = mongoose.models.SystemSettings
    || mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = { SystemSettings };
