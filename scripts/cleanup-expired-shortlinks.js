'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const shortlinkCleanupService = require('../services/shortlinkCleanup.service');

async function main() {
    if (!process.env.MONGODB_URI) {
        console.error('Missing MONGODB_URI');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    console.log('Connected to MongoDB');

    const result = await shortlinkCleanupService.runSafe('cli');
    console.log('Cleanup result:', result);

    await mongoose.disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
