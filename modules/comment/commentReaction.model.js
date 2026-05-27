
const mongoose = require('mongoose');

const commentReactionSchema = new mongoose.Schema({
    commentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
        required: true
    }
}, {
    timestamps: true
});

commentReactionSchema.index({ commentId: 1, userId: 1 }, { unique: true });
commentReactionSchema.index({ commentId: 1, type: 1 });

const CommentReaction = mongoose.models.CommentReaction || mongoose.model('CommentReaction', commentReactionSchema);

module.exports = CommentReaction;
