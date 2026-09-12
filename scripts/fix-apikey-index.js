const mongoose = require('mongoose');
require('dotenv').config();

async function fixApiKeyIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Check existing indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(i => ({ name: i.name, key: i.key })));

    // Count documents with apiKey: null
    const nullCount = await collection.countDocuments({ apiKey: null });
    console.log(`Documents with apiKey: null: ${nullCount}`);

    // Drop the apiKey_1 index if it exists
    const apiKeyIndex = indexes.find(i => i.name === 'apiKey_1');
    if (apiKeyIndex) {
      console.log('Dropping apiKey_1 index...');
      await collection.dropIndex('apiKey_1');
      console.log('apiKey_1 index dropped');
    }

    // Create sparse index on apiKey with unique constraint
    console.log('Creating sparse unique index on apiKey...');
    await collection.createIndex({ apiKey: 1 }, { 
      name: 'apiKey_1',
      sparse: true,
      unique: true
    });
    console.log('Sparse unique index created on apiKey');

    // Verify the new index
    const newIndexes = await collection.indexes();
    console.log('Updated indexes:', newIndexes.map(i => ({ name: i.name, key: i.key, sparse: i.sparse, unique: i.unique })));

    console.log('Index fix completed successfully');
  } catch (error) {
    console.error('Error fixing index:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixApiKeyIndex();
