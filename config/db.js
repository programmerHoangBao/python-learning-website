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
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

function getDB() {
  return db;
}

module.exports = { connectDB, getDB };