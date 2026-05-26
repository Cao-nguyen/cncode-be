const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true },
});

const UserGardenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    water: { type: Number, default: 0 },
    growth: { type: Number, default: 0 },
    stage: { type: Number, default: 1 },
    totalCoins: { type: Number, default: 0 }
});

// KHẮC PHỤC LỖI TẠI ĐÂY: Kiểm tra nếu model đã tồn tại thì dùng lại, chưa thì mới tạo mới
const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);
const UserGarden = mongoose.models.UserGarden || mongoose.model('UserGarden', UserGardenSchema);

module.exports = { Question, UserGarden };