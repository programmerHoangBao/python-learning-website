const { MongoClient } = require('mongodb');
require('dotenv').config();

const url = process.env.MONGODB_URI;
const client = new MongoClient(url);

let db;

async function connectDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db();
    // Tạo text index trên trường 'name' của collection 'courses'
    await db.collection('courses').createIndex({ name: 'text' }, (err, result) => {
      if (err) {
        console.error('Lỗi khi tạo text index:', err);
      } else {
        console.log('Text index được tạo trên trường "name" của collection "courses":', result);
      }
      return db;
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

function getDB() {
  return db;
}

module.exports = { connectDB, getDB };