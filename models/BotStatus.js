const mongoose = require('mongoose');

// Single document (key: 'main') updated by the bot heartbeat
const botStatusSchema = new mongoose.Schema({
  key:      { type: String, default: 'main', unique: true },
  state:    { type: String, enum: ['running', 'stopped'], default: 'stopped' },
  cycle:    { type: Number, default: 0 },
  host:     { type: String, default: '' },
  lastSeen: { type: Date, default: null },
  startedAt:{ type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('BotStatus', botStatusSchema);