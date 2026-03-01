const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  accountStatus: {
    type: String,
    enum: ['New', 'Unbanned', 'Banned'],
    default: 'New'
  },
  accountEmail: { type: String, required: true, trim: true },
  accountPassword: { type: String, required: true },
  additionalAccountPassword: { type: String, default: '-' },
  accountRecovery: { type: String, default: '-' },
  accountLevel: { type: Number, default: 1, min: 1, max: 999 },
  salesStatus: {
    type: String,
    enum: ['Unsold', 'Sold'],
    default: 'Unsold'
  },
  notes: { type: String, default: '' },
  price: { type: Number, default: 0 },
}, { timestamps: true });

accountSchema.index({ accountEmail: 1 });
accountSchema.index({ accountStatus: 1, salesStatus: 1 });
accountSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Account', accountSchema);
