const mongoose = require('mongoose');
const { Contest, UserAnswer } = require('../modules/dautruong/dautruong.model');

async function fixUserAnswerPercentage() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cncode');
        console.log('Connected to MongoDB');

        // Find all UserAnswers that don't have percentage or have percentage = 0
        const userAnswers = await UserAnswer.find({
            $or: [
                { percentage: { $exists: false } },
                { percentage: 0 }
            ]
        }).populate('contestId');

        console.log(`Found ${userAnswers.length} submissions to fix`);

        let fixed = 0;
        for (const userAnswer of userAnswers) {
            if (!userAnswer.contestId) {
                console.log(`Skipping submission ${userAnswer._id} - contest not found`);
                continue;
            }

            const contest = userAnswer.contestId;

            // Calculate percentage
            const percentage = contest.totalPoints > 0
                ? (userAnswer.totalScore / contest.totalPoints) * 100
                : 0;

            // Update the submission
            await UserAnswer.findByIdAndUpdate(userAnswer._id, {
                percentage: percentage
            });

            fixed++;
            console.log(`Fixed submission ${userAnswer._id}: ${userAnswer.totalScore}/${contest.totalPoints} = ${percentage.toFixed(1)}%`);
        }

        console.log(`\nFixed ${fixed} submissions`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixUserAnswerPercentage();