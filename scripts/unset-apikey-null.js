const mongoose = require('mongoose');
require('dotenv').config();

async function unsetApiKeyNull() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = require('../modules/user/user.model');

    // Count documents with apiKey: null
    const nullCount = await User.countDocuments({ apiKey: null });
    console.log(`Documents with apiKey: null: ${nullCount}`);

    if (nullCount > 0) {
      console.log('Unsetting apiKey field from documents with null value...');
      const result = await User.updateMany(
        { apiKey: null },
        { $unset: { apiKey: "" } }
      );
      console.log(`Unset apiKey from ${result.modifiedCount} documents`);
    }

    // Verify
    const afterCount = await User.countDocuments({ apiKey: null });
    console.log(`Documents with apiKey: null after unset: ${afterCount}`);

    // Count documents without apiKey field
    const withoutApiKeyCount = await User.countDocuments({ apiKey: { $exists: false } });
    console.log(`Documents without apiKey field: ${withoutApiKeyCount}`);

    console.log('Unset completed successfully');
  } catch (error) {
    console.error('Error unsetting apiKey:', error);
  } finally {
    await mongoose.disconnect();
  }
}

unsetApiKeyNull();
