const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  accountStatus: {
    type: String,
    enum: ['New', 'Unbanned', 'Banned'],
    default: 'New'
  },
  accountEmail: { type: String, required: true },
  accountPassword: { type: String, required: true },
  additionalAccountPassword: { type: String, default: '-' },
  accountRecovery: { type: String, default: '-' },
  accountLevel: { type: Number, default: 1 },
  salesStatus: {
    type: String,
    enum: ['Unsold', 'Sold'],
    default: 'Unsold'
  }
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
