const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const conn = await mongoose.connect(process.env.MONGO_URI, {
    dbName: 'fixitfast',
  });

  isConnected = true;
  console.log(`✅ MongoDB connected: ${conn.connection.host}`);
}

module.exports = connectDB;
