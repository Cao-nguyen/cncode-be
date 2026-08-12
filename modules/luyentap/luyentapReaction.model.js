const mongoose = require('mongoose');

const luyentapReactionSchema = new mongoose.Schema({
    exerciseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PracticeExercise',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'],
        required: true,
    },
}, {
    timestamps: true,
});

luyentapReactionSchema.index({ exerciseId: 1, userId: 1 }, { unique: true });
luyentapReactionSchema.index({ exerciseId: 1, type: 1 });

const PracticeExerciseReaction = mongoose.models.PracticeExerciseReaction
    || mongoose.model('PracticeExerciseReaction', luyentapReactionSchema);

module.exports = PracticeExerciseReaction;
