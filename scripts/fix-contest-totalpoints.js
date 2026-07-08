const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const { Contest } = require('../modules/dautruong/dautruong.model');

async function fixContestTotalPoints() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find all contests
        const contests = await Contest.find({});
        console.log(`Found ${contests.length} contests`);

        let updatedCount = 0;

        for (const contest of contests) {
            const questionCount = contest.questions ? contest.questions.length : 0;
            const correctTotalPoints = questionCount * 10;

            if (contest.totalPoints !== correctTotalPoints) {
                console.log(`Updating contest "${contest.title}": ${contest.totalPoints} -> ${correctTotalPoints} points`);
                await Contest.findByIdAndUpdate(contest._id, {
                    totalPoints: correctTotalPoints
                });
                updatedCount++;
            }
        }

        console.log(`\nFixed ${updatedCount} contests`);
        console.log('Migration completed successfully!');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

fixContestTotalPoints();