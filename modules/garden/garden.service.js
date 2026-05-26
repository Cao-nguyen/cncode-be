const { Question, Tree, UserGarden } = require('./garden.model');

class GardenService {
    async getUserGarden(userId) {
        let garden = await UserGarden.findOne({ userId })
            .populate('currentTreeId')
            .populate('trees.treeId')
            .populate('ownedTrees');
        if (!garden) {
            const defaultTrees = await Tree.find({ isDefault: true, isActive: true });
            garden = await UserGarden.create({
                userId,
                water: 50,
                totalCoins: 0,
                ownedTrees: defaultTrees.map(t => t._id)
            });
            garden = await UserGarden.findById(garden._id)
                .populate('currentTreeId')
                .populate('trees.treeId')
                .populate('ownedTrees');
        }
        return garden;
    }

    async getAvailableTrees(userId) {
        const garden = await this.getUserGarden(userId);
        const ownedTreeIds = garden.ownedTrees.map(t => t._id.toString());
        const allTrees = await Tree.find({ isActive: true });

        return {
            owned: allTrees.filter(t => ownedTreeIds.includes(t._id.toString())),
            shop: allTrees.filter(t => !ownedTreeIds.includes(t._id.toString()) && t.price > 0)
        };
    }

    async buyTree(userId, treeId) {
        const garden = await UserGarden.findOne({ userId });
        if (!garden) throw new Error('Không tìm thấy khu vườn');

        const tree = await Tree.findById(treeId);
        if (!tree) throw new Error('Không tìm thấy cây');

        if (garden.ownedTrees.includes(treeId)) {
            throw new Error('Bạn đã sở hữu cây này');
        }

        if (garden.totalCoins < tree.price) {
            throw new Error(`Không đủ xu! Cần ${tree.price} xu để mua cây này.`);
        }

        garden.totalCoins -= tree.price;
        garden.ownedTrees.push(treeId);
        await garden.save();

        return await UserGarden.findOne({ userId }).populate('ownedTrees');
    }

    async plantTree(userId, treeId) {
        const garden = await UserGarden.findOne({ userId });
        if (!garden) throw new Error('Không tìm thấy khu vườn');

        const tree = await Tree.findById(treeId);
        if (!tree) throw new Error('Không tìm thấy loại cây');

        if (!garden.ownedTrees.includes(treeId)) {
            throw new Error('Bạn chưa sở hữu cây này');
        }

        const activeTreeCount = garden.trees.filter(t => t.isActive).length;
        if (activeTreeCount >= 3) {
            throw new Error('Bạn chỉ có thể trồng tối đa 3 cây cùng lúc');
        }

        garden.trees.push({
            treeId: treeId,
            stage: 1,
            growth: 0,
            isActive: true,
            plantedAt: new Date()
        });
        garden.currentTreeId = treeId;

        await garden.save();
        return await UserGarden.findOne({ userId }).populate('currentTreeId').populate('trees.treeId');
    }

    async harvestTree(userId, treeIndex) {
        const garden = await UserGarden.findOne({ userId });
        if (!garden) throw new Error('Không tìm thấy khu vườn');

        const activeTree = garden.trees[treeIndex];
        if (!activeTree || !activeTree.isActive) throw new Error('Không có cây nào để thu hoạch');

        const tree = await Tree.findById(activeTree.treeId);
        if (!tree) throw new Error('Không tìm thấy loại cây');

        if (activeTree.stage < tree.stageThresholds.length) {
            throw new Error('Cây chưa trưởng thành để thu hoạch!');
        }

        const bonusCoins = Math.floor(Math.random() * (tree.maxCoins - tree.minCoins + 1) + tree.minCoins);

        activeTree.isActive = false;
        activeTree.harvestedAt = new Date();
        garden.totalCoins += bonusCoins;
        garden.totalHarvests += 1;

        if (garden.currentTreeId?.toString() === activeTree.treeId.toString()) {
            garden.currentTreeId = null;
        }

        await garden.save();
        return {
            bonusCoins,
            garden: await UserGarden.findOne({ userId }).populate('currentTreeId').populate('trees.treeId')
        };
    }

    async waterTree(userId, treeIndex) {
        const garden = await UserGarden.findOne({ userId });
        if (!garden) throw new Error('Không tìm thấy khu vườn');

        const activeTree = garden.trees[treeIndex];
        if (!activeTree || !activeTree.isActive) throw new Error('Không có cây nào để tưới');

        const tree = await Tree.findById(activeTree.treeId);
        if (!tree) throw new Error('Không tìm thấy loại cây');

        if (garden.water < tree.waterRequired) {
            throw new Error(`Không đủ nước! Cần ${tree.waterRequired} nước để tưới.`);
        }

        garden.water -= tree.waterRequired;

        let newGrowth = activeTree.growth + tree.growthPerWater;
        let newStage = activeTree.stage;
        let stageUp = false;

        if (newGrowth >= 100) {
            newGrowth = 0;
            newStage = activeTree.stage + 1;
            stageUp = true;
            if (newStage >= tree.stageThresholds.length) {
                newStage = tree.stageThresholds.length;
            }
        }

        activeTree.growth = newGrowth;
        activeTree.stage = newStage;

        await garden.save();

        return {
            garden: await UserGarden.findOne({ userId }).populate('currentTreeId').populate('trees.treeId'),
            waterUsed: tree.waterRequired,
            newGrowth,
            stageUp,
            newStage,
            treeIndex,
            canHarvest: newStage >= tree.stageThresholds.length
        };
    }

    async getRandomQuestion(category = null) {
        const query = {};
        if (category && category !== 'all') query.category = category;
        const count = await Question.countDocuments(query);
        if (count === 0) return null;
        const random = Math.floor(Math.random() * count);
        return await Question.findOne(query).skip(random);
    }

    async checkAnswer(userId, questionId, answerIndex) {
        const question = await Question.findById(questionId);
        if (!question) throw new Error('Không tìm thấy câu hỏi');

        const isCorrect = question.correctAnswer === answerIndex;

        if (isCorrect) {
            const garden = await UserGarden.findOne({ userId });
            if (garden) {
                garden.water += question.xpReward;
                garden.totalQuestions += 1;
                garden.correctAnswers += 1;
                await garden.save();
            }
            return {
                correct: true,
                waterReceived: question.xpReward,
                correctAnswer: question.correctAnswer
            };
        }

        return {
            correct: false,
            correctAnswer: question.correctAnswer
        };
    }

    async getGardenStats(userId) {
        const garden = await this.getUserGarden(userId);
        const treesWithDetails = await Promise.all(
            garden.trees.map(async (t, idx) => {
                const tree = await Tree.findById(t.treeId);
                return {
                    index: idx,
                    id: tree._id,
                    name: tree.name,
                    stage: t.stage,
                    growth: t.growth,
                    stageName: tree.stages[t.stage - 1] || `Giai đoạn ${t.stage}`,
                    waterRequired: tree.waterRequired,
                    canHarvest: t.stage >= tree.stageThresholds.length,
                    isActive: t.isActive
                };
            })
        );

        const totalQuestions = await Question.countDocuments();

        return {
            water: garden.water,
            totalCoins: garden.totalCoins,
            totalQuestions: garden.totalQuestions,
            correctAnswers: garden.correctAnswers,
            availableQuestions: totalQuestions,
            totalHarvests: garden.totalHarvests,
            trees: treesWithDetails.filter(t => t.isActive),
            ownedTreesCount: garden.ownedTrees.length,
            maxTrees: 3
        };
    }

    async addQuestion(data) {
        return await Question.create(data);
    }

    async updateQuestion(id, data) {
        return await Question.findByIdAndUpdate(id, data, { new: true });
    }

    async deleteQuestion(id) {
        return await Question.findByIdAndDelete(id);
    }

    async getAllQuestions(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [questions, total] = await Promise.all([
            Question.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
            Question.countDocuments()
        ]);
        return { questions, total, page, totalPages: Math.ceil(total / limit) };
    }

    async addTree(data) {
        return await Tree.create(data);
    }

    async updateTree(id, data) {
        return await Tree.findByIdAndUpdate(id, data, { new: true });
    }

    async deleteTree(id) {
        return await Tree.findByIdAndDelete(id);
    }

    async getAllTrees() {
        return await Tree.find({ isActive: true });
    }

    async parseQuestionText(text) {
        const lines = text.split('\n');
        const questions = [];
        let currentQuestion = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const questionMatch = trimmed.match(/^Câu\s+(\d+)[:.)]\s*(.+)$/i);
            if (questionMatch) {
                if (currentQuestion) {
                    questions.push(currentQuestion);
                }
                currentQuestion = {
                    question: questionMatch[2].trim(),
                    options: [],
                    correctAnswer: -1
                };
                continue;
            }

            const optionMatch = trimmed.match(/^([*]?)([A-D])[.)]\s*(.+)$/i);
            if (optionMatch && currentQuestion) {
                const isCorrect = optionMatch[1] === '*';
                const optionText = optionMatch[3].trim();
                const optionIndex = currentQuestion.options.length;
                currentQuestion.options.push(optionText);
                if (isCorrect) {
                    currentQuestion.correctAnswer = optionIndex;
                }
            }
        }

        if (currentQuestion) {
            questions.push(currentQuestion);
        }

        return questions.filter(q => q.options.length === 4 && q.correctAnswer >= 0);
    }

    async addMultipleQuestions(questionsData) {
        const results = [];
        for (const q of questionsData) {
            try {
                const question = await Question.create({
                    question: q.question,
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    category: 'general',
                    difficulty: 'medium',
                    xpReward: 15
                });
                results.push({ success: true, data: question });
            } catch (error) {
                results.push({ success: false, error: error.message, question: q.question });
            }
        }
        return results;
    }
}

module.exports = new GardenService();