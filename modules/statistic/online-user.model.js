const mongoose = require('mongoose');

const onlineUserSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String
    },
    lastActivity: {
        type: Date,
        default: Date.now,
        expires: 300
    },
    currentPage: {
        type: String
    }
}, {
    timestamps: true
});

onlineUserSchema.index({ lastActivity: -1 });
onlineUserSchema.index({ userId: 1 });
onlineUserSchema.index({ sessionId: 1 });

module.exports = mongoose.model('OnlineUser', onlineUserSchema);