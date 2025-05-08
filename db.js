// db.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const dbName = 'cardgallery';

async function connectDB() {
  if (!client.isConnected && !client.topology?.isConnected()) {
    await client.connect();
  }
  return client.db(dbName);
}

module.exports = connectDB;