const gardenService = require('./garden.service');

module.exports = {
    async getGarden(req, res) {
        try {
            const garden = await gardenService.getUserGarden(req.userId);
            const stats = await gardenService.getGardenStats(req.userId);
            res.json({ success: true, data: { garden, stats } });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async getAvailableTrees(req, res) {
        try {
            const trees = await gardenService.getAvailableTrees(req.userId);
            res.json({ success: true, data: trees });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async buyTree(req, res) {
        try {
            const { treeId } = req.body;
            const garden = await gardenService.buyTree(req.userId, treeId);
            res.json({ success: true, data: garden });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async plantTree(req, res) {
        try {
            const { treeId } = req.body;
            const garden = await gardenService.plantTree(req.userId, treeId);
            res.json({ success: true, data: garden });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async harvestTree(req, res) {
        try {
            const { treeIndex } = req.body;
            const result = await gardenService.harvestTree(req.userId, treeIndex);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async waterTree(req, res) {
        try {
            const { treeIndex } = req.body;
            const result = await gardenService.waterTree(req.userId, treeIndex);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getQuestion(req, res) {
        try {
            const { category } = req.query;
            const question = await gardenService.getRandomQuestion(category);
            if (!question) {
                return res.status(404).json({ success: false, message: 'Chưa có câu hỏi nào' });
            }
            res.json({ success: true, data: question });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async submitAnswer(req, res) {
        try {
            const { questionId, answerIndex } = req.body;
            const result = await gardenService.checkAnswer(req.userId, questionId, answerIndex);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async getGardenStats(req, res) {
        try {
            const stats = await gardenService.getGardenStats(req.userId);
            res.json({ success: true, data: stats });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async getAllQuestions(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const result = await gardenService.getAllQuestions(parseInt(page), parseInt(limit));
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async addQuestion(req, res) {
        try {
            const question = await gardenService.addQuestion(req.body);
            res.status(201).json({ success: true, data: question });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async addMultipleQuestions(req, res) {
        try {
            const { text } = req.body;
            const parsedQuestions = await gardenService.parseQuestionText(text);
            const results = await gardenService.addMultipleQuestions(parsedQuestions);
            res.json({ success: true, data: results });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async updateQuestion(req, res) {
        try {
            const question = await gardenService.updateQuestion(req.params.id, req.body);
            res.json({ success: true, data: question });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async deleteQuestion(req, res) {
        try {
            await gardenService.deleteQuestion(req.params.id);
            res.json({ success: true, message: 'Xóa câu hỏi thành công' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async getAllTrees(req, res) {
        try {
            const trees = await gardenService.getAllTrees();
            res.json({ success: true, data: trees });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async addTree(req, res) {
        try {
            const tree = await gardenService.addTree(req.body);
            res.status(201).json({ success: true, data: tree });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async updateTree(req, res) {
        try {
            const tree = await gardenService.updateTree(req.params.id, req.body);
            res.json({ success: true, data: tree });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    async deleteTree(req, res) {
        try {
            await gardenService.deleteTree(req.params.id);
            res.json({ success: true, message: 'Xóa cây thành công' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};
