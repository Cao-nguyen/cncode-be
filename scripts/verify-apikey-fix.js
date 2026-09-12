const mongoose = require('mongoose');
require('dotenv').config();

async function verifyApiKeyFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Check documents with apiKey field
    const withApiKey = await collection.find({ apiKey: { $exists: true } }).toArray();
    console.log(`Documents with apiKey field: ${withApiKey.length}`);

    // Check documents without apiKey field
    const withoutApiKey = await collection.find({ apiKey: { $exists: false } }).toArray();
    console.log(`Documents without apiKey field: ${withoutApiKey.length}`);

    // Check documents with apiKey: null
    const withNullApiKey = await collection.find({ apiKey: null }).toArray();
    console.log(`Documents with apiKey: null: ${withNullApiKey.length}`);

    // Show sample document without apiKey
    if (withoutApiKey.length > 0) {
      console.log('Sample document without apiKey:', {
        _id: withoutApiKey[0]._id,
        email: withoutApiKey[0].email,
        hasApiKey: 'apiKey' in withoutApiKey[0]
      });
    }

    console.log('Verification completed');
  } catch (error) {
    console.error('Error verifying:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verifyApiKeyFix();
