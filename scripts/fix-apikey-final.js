const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function fixApiKeyFinal() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Check current state
    const withNull = await collection.countDocuments({ apiKey: null });
    const withoutField = await collection.countDocuments({ apiKey: { $exists: false } });
    console.log(`Before - with apiKey: null: ${withNull}, without field: ${withoutField}`);

    // Use bulkWrite to unset apiKey field from all documents
    console.log('Unsetting apiKey field from all documents...');
    const result = await collection.bulkWrite([
      {
        updateMany: {
          filter: {},
          update: { $unset: { apiKey: "" } }
        }
      }
    ]);
    console.log(`Bulk write result: ${result.modifiedCount} documents modified`);

    // Verify after fix
    const afterNull = await collection.countDocuments({ apiKey: null });
    const afterWithout = await collection.countDocuments({ apiKey: { $exists: false } });
    console.log(`After - with apiKey: null: ${afterNull}, without field: ${afterWithout}`);

    // Recreate sparse unique index
    const indexes = await collection.indexes();
    const apiKeyIndex = indexes.find(i => i.name === 'apiKey_1');
    if (apiKeyIndex) {
      console.log('Dropping existing apiKey_1 index...');
      await collection.dropIndex('apiKey_1');
    }

    console.log('Creating sparse unique index on apiKey...');
    await collection.createIndex({ apiKey: 1 }, { 
      name: 'apiKey_1',
      sparse: true,
      unique: true
    });

    console.log('Fix completed successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixApiKeyFinal();
