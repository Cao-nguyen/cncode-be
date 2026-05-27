
const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    value: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        enum: ['text', 'html', 'json', 'image'],
        default: 'html'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Setting', settingSchema);
