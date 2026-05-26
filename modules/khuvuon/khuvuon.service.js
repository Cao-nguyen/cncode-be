const { Question, UserGarden } = require('./khuvuon.model');

class GardenService {
    async getGarden(userId) {
        let garden = await UserGarden.findOne({ userId });
        if (!garden) garden = await UserGarden.create({ userId });
        return garden;
    }

    async getRandomQuestion() {
        const count = await Question.countDocuments();
        const random = Math.floor(Math.random() * count);
        return Question.findOne().skip(random);
    }

    async checkAnswer(userId, questionId, answerIndex) {
        const question = await Question.findById(questionId);
        if (question && question.correctAnswer === answerIndex) {
            await UserGarden.findOneAndUpdate({ userId }, { $inc: { water: 15 } });
            return { correct: true, waterReceived: 15 };
        }
        return { correct: false };
    }

    async waterTree(userId) {
        const garden = await UserGarden.findOne({ userId });
        if (garden.water < 10) throw new Error("Không đủ nước! Cần 10 đơn vị.");

        let bonusCoin = 0;
        let newGrowth = garden.growth + 25;
        let newStage = garden.stage;

        if (newGrowth >= 100) {
            newGrowth = 0;
            newStage = newStage < 3 ? newStage + 1 : 1; // Vòng lặp hoặc kịch trần
            bonusCoin = Math.floor(Math.random() * 100) + 20;
        }

        const updated = await UserGarden.findOneAndUpdate(
            { userId },
            {
                $set: { growth: newGrowth, stage: newStage },
                $inc: { water: -10, totalCoins: bonusCoin }
            },
            { new: true }
        );

        return { garden: updated, bonusCoin };
    }

    // Admin
    async addQuestion(data) { return await Question.create(data); }
    async getAllQuestions() { return await Question.find(); }
}

module.exports = new GardenService();