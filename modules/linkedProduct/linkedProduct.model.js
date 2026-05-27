
const mongoose = require('mongoose');

const linkedProductSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Tên sản phẩm là bắt buộc'],
            trim: true,
            maxlength: 255,
        },
        thumbnailUrl: {
            type: String,
            default: '',
        },
        productUrl: {
            type: String,
            required: [true, 'URL sản phẩm là bắt buộc'],
            trim: true,
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'deleted'],
            default: 'active',
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

linkedProductSchema.index({ userId: 1, status: 1 });
linkedProductSchema.index({ status: 1, sortOrder: 1 });

module.exports = mongoose.model('LinkedProduct', linkedProductSchema);
