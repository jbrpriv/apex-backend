const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const jwt = require('jsonwebtoken');

// Middleware that accepts token from header OR query param
const authForExport = (req, res, next) => {
  const token = (req.headers.authorization?.split(' ')[1]) || req.query.token;
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// GET /api/export/csv
router.get('/csv', authForExport, async (req, res) => {
  try {
    const accounts = await Account.find().sort({ createdAt: -1 });

    const header = [
      'Email',
      'Password',
      'Additional Password',
      'Recovery Email',
      'Account Status',
      'Sales Status',
      'Level',
      'Rank',
      'RFR Bought',
      'Price (Rs)',
      'Apex Username',
      'Apex Platform',
      'Last Synced',
      'Sync Error',
      'Notes',
      'Created At',
      'Updated At',
    ];

    const rows = accounts.map(a => [
      a.accountEmail,
      a.accountPassword,
      a.additionalAccountPassword || '-',
      a.accountRecovery           || '-',
      a.accountStatus,
      a.salesStatus,
      a.accountLevel,
      a.rank                      || 'Unranked',
      a.rfrBought ? 'Yes' : 'No',
      a.price                     || 0,
      a.apexUsername              || '-',
      a.apexPlatform              || 'PC',
      a.lastSynced ? a.lastSynced.toISOString() : '-',
      a.syncError                 || '-',
      a.notes                     || '-',
      a.createdAt.toISOString(),
      a.updatedAt.toISOString(),
    ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));

    const csv = [header.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="accounts-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/export/json
router.get('/json', authForExport, async (req, res) => {
  try {
    const accounts = await Account.find().sort({ createdAt: -1 });

    // Shape each account into a clean, ordered object instead of raw mongoose doc
    const data = accounts.map(a => ({
      id:                       a._id,
      accountEmail:             a.accountEmail,
      accountPassword:          a.accountPassword,
      additionalAccountPassword: a.additionalAccountPassword || '-',
      accountRecovery:          a.accountRecovery            || '-',
      accountStatus:            a.accountStatus,
      salesStatus:              a.salesStatus,
      accountLevel:             a.accountLevel,
      rank:                     a.rank                       || 'Unranked',
      rfrBought:                a.rfrBought,
      price:                    a.price                      || 0,
      apexUsername:             a.apexUsername               || '-',
      apexPlatform:             a.apexPlatform               || 'PC',
      lastSynced:               a.lastSynced                 || null,
      syncError:                a.syncError                  || null,
      notes:                    a.notes                      || '-',
      createdAt:                a.createdAt,
      updatedAt:                a.updatedAt,
    }));

    res.setHeader('Content-Disposition', `attachment; filename="accounts-${Date.now()}.json"`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;