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
    const header = ['Email','Password','Additional Password','Recovery','Level','Account Status','Sales Status','Price','Notes','Created At'];
    const rows = accounts.map(a => [
      a.accountEmail, a.accountPassword,
      a.additionalAccountPassword || '-', a.accountRecovery || '-',
      a.accountLevel, a.accountStatus, a.salesStatus,
      a.price || 0, a.notes || '',
      a.createdAt.toISOString()
    ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="accounts-' + Date.now() + '.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/export/json
router.get('/json', authForExport, async (req, res) => {
  try {
    const accounts = await Account.find().sort({ createdAt: -1 });
    res.setHeader('Content-Disposition', 'attachment; filename="accounts-' + Date.now() + '.json"');
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
