const mongoose = require('mongoose');

const botLogSchema = new mongoose.Schema({
  level:   { type: String, enum: ['info', 'success', 'warn', 'error'], default: 'info' },
  message: { type: String, required: true, maxlength: 500 },
  ts:      { type: Date, default: Date.now },                 // time on the bot machine
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 } // auto-delete after 24h
});

module.exports = mongoose.model('BotLog', botLogSchema);