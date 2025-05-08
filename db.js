const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

let client;
let db;

async function connectDB() {
  if (db) return db;

  client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  await client.connect();
  db = client.db(); // This will use the database name from the URI
  console.log('✅ MongoDB connected');
  return db;
}

module.exports = connectDB;
