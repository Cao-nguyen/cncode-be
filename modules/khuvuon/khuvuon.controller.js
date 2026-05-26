const GardenService = require('./khuvuon.service');

exports.getGarden = async (req, res) => {
    try {
        // Sử dụng req.userId (do middleware authenticate gán vào)
        const data = await GardenService.getGarden(req.userId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getQuestion = async (req, res) => {
    try {
        const question = await GardenService.getRandomQuestion();
        res.json(question);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.submitAnswer = async (req, res) => {
    try {
        const { questionId, answerIndex } = req.body;
        // Sử dụng req.userId
        const result = await GardenService.checkAnswer(req.userId, questionId, answerIndex);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.waterTree = async (req, res) => {
    try {
        // Sử dụng req.userId
        const result = await GardenService.waterTree(req.userId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.addQuestion = async (req, res) => {
    try {
        const q = await GardenService.addQuestion(req.body);
        res.json(q);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};