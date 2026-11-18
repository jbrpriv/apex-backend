const mongoose = require('mongoose');

// Commands queued from the dashboard, picked up by the Python bot (polling).
const botCommandSchema = new mongoose.Schema({
  type:      { type: String, enum: ['escBtn', 'spaceBtn', 'enterBtn', 'mouse'], required: true },
  text:      { type: String, default: '', maxlength: 60 },   // keyword for "mouse"
  claimed:   { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 60 }  // auto-delete after 60s so stale commands never run
});

module.exports = mongoose.model('BotCommand', botCommandSchema);