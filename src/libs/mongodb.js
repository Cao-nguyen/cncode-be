const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URL = process.env.MONGODB_URL;

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URL);
        console.log('✓ MongoDB Connected');
    } catch (error) {
        console.error('✗ MongoDB Error:', error.message);
        process.exit(1);
    }
};

const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        console.log('✓ MongoDB Disconnected');
    } catch (error) {
        console.error('✗ Disconnect Error:', error.message);
        process.exit(1);
    }
};

module.exports = { connectDB, disconnectDB };
