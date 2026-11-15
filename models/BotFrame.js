const mongoose = require('mongoose');

// Single document (key: 'main') holding the latest screenshot from the bot
const botFrameSchema = new mongoose.Schema({
  key:       { type: String, default: 'main', unique: true },
  image:     { type: Buffer, required: true },   // JPEG bytes
  width:     { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BotFrame', botFrameSchema);