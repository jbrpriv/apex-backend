const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
require('node:dns/promises').setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/settings', require('./routes/settings'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

let isConnected = false;

const connectDB = async () => {
  console.log('connectDB called, isConnected:', isConnected);
  if (isConnected) return;
  console.log('MONGO_URI exists:', !!process.env.MONGO_URI);
  console.log('Attempting mongoose.connect...');
  await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
  console.log('MongoDB connected');
  console.log('Running seeders...');
  await require('./seeder')();
  console.log('Seeders done');
};

connectDB().catch(err => {
  console.error('MongoDB error type:', err.constructor.name);
  console.error('MongoDB error message:', err.message);
});

connectDB().catch(err => console.error('MongoDB error:', err));

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;