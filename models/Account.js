const mongoose = require('mongoose');

const RANK_ENUM = [
  'Unranked',
  'Bronze IV','Bronze III','Bronze II','Bronze I',
  'Silver IV','Silver III','Silver II','Silver I',
  'Gold IV','Gold III','Gold II','Gold I',
  'Platinum IV','Platinum III','Platinum II','Platinum I',
  'Diamond IV','Diamond III','Diamond II','Diamond I',
  'Master','Predator'
];

const accountSchema = new mongoose.Schema({
  accountStatus: {
    type: String,
    enum: ['New', 'Unbanned', 'Banned'],
    default: 'Unbanned'
  },
  accountEmail:    { type: String, required: true, trim: true },
  accountPassword: { type: String, required: true },
  additionalAccountPassword: { type: String, default: '-' },
  accountRecovery: { type: String, default: '-' },
  accountLevel:    { type: Number, default: 1, min: 1, max: 9999 },
  salesStatus: {
    type: String,
    enum: ['Unsold', 'Sold'],
    default: 'Unsold'
  },
  notes:     { type: String, default: '' },
  price:     { type: Number, default: 0 },
  rfrBought: { type: Boolean, default: false },
  rank: {
    type: String,
    enum: RANK_ENUM,
    default: 'Unranked'
  },

  // ── Apex API sync fields ──────────────────────────────
  apexUsername: { type: String, default: '', trim: true },       // e.g. "tashbottle7001"
  apexPlatform: {
    type: String,
    enum: ['PC', 'PS4', 'X1'],
    default: 'PC'
  },
  lastSynced:   { type: Date, default: null },                   // timestamp of last successful API sync
  syncError:    { type: String, default: '' },                   // last sync error message if any

}, { timestamps: true });

accountSchema.index({ accountEmail: 1 });
accountSchema.index({ accountStatus: 1, salesStatus: 1 });
accountSchema.index({ createdAt: -1 });
accountSchema.index({ apexUsername: 1 });

module.exports = mongoose.model('Account', accountSchema);
module.exports.RANK_ENUM = RANK_ENUM;
