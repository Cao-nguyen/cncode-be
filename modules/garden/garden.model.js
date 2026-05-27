const mongoose = require('mongoose');

const GardenQuestionSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true, min: 0 },
    category: {
        type: String,
        enum: ['math', 'programming', 'science', 'general'],
        default: 'general'
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'easy'
    },
    xpReward: { type: Number, default: 15 }
}, { timestamps: true });

const GardenTreeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    stages: [{ type: String, required: true }],
    waterRequired: { type: Number, default: 10 },
    growthPerWater: { type: Number, default: 25 },
    stageThresholds: [{ type: Number, default: [0, 30, 70, 100] }],
    minCoins: { type: Number, default: 20 },
    maxCoins: { type: Number, default: 100 },
    price: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const GardenUserSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    currentTreeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GardenTree',
        default: null
    },
    trees: [{
        treeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'GardenTree',
            required: true
        },
        stage: { type: Number, default: 1 },
        growth: { type: Number, default: 0 },
        isActive: { type: Boolean, default: false },
        plantedAt: { type: Date, default: Date.now },
        harvestedAt: { type: Date }
    }],
    ownedTrees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GardenTree'
    }],
    water: { type: Number, default: 50 },
    totalCoins: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    totalHarvests: { type: Number, default: 0 }
}, { timestamps: true });

GardenQuestionSchema.index({ category: 1 });
GardenUserSchema.index({ userId: 1 });
GardenTreeSchema.index({ isActive: 1 });

const GardenQuestion = mongoose.models.GardenQuestion || mongoose.model('GardenQuestion', GardenQuestionSchema);
const GardenTree = mongoose.models.GardenTree || mongoose.model('GardenTree', GardenTreeSchema);
const GardenUser = mongoose.models.GardenUser || mongoose.model('GardenUser', GardenUserSchema);

module.exports = { Question: GardenQuestion, Tree: GardenTree, UserGarden: GardenUser };
