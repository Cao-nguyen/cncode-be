const mongoose = require('mongoose');

const practiceFolderSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    description: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
    },
    sortOrder: {
        type: Number,
        default: 0,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

practiceFolderSchema.index({ sortOrder: 1, createdAt: -1 });

module.exports = mongoose.model('PracticeFolder', practiceFolderSchema);
