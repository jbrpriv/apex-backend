const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/accounts — list with filters/search/sort/pagination
router.get('/', async (req, res) => {
  try {
    const { accountStatus, salesStatus, search, sort = 'createdAt', dir = 'desc', page = 1, limit = 100 } = req.query;
    let filter = {};
    if (accountStatus) filter.accountStatus = accountStatus;
    if (salesStatus) filter.salesStatus = salesStatus;
    if (search) {
      filter.$or = [
        { accountEmail: { $regex: search, $options: 'i' } },
        { accountRecovery: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }
    const sortObj = { [sort]: dir === 'asc' ? 1 : -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [accounts, total] = await Promise.all([
      Account.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit)),
      Account.countDocuments(filter)
    ]);
    res.json({ accounts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/accounts/stats (needed before /:id)
router.get('/stats', async (req, res) => {
  try {
    const [total, sold, unsold, banned, unbanned, newAcc] = await Promise.all([
      Account.countDocuments(),
      Account.countDocuments({ salesStatus: 'Sold' }),
      Account.countDocuments({ salesStatus: 'Unsold' }),
      Account.countDocuments({ accountStatus: 'Banned' }),
      Account.countDocuments({ accountStatus: 'Unbanned' }),
      Account.countDocuments({ accountStatus: 'New' }),
    ]);
    const avgLevel = await Account.aggregate([{ $group: { _id: null, avg: { $avg: '$accountLevel' } } }]);
    res.json({ total, sold, unsold, banned, unbanned, new: newAcc, avgLevel: Math.round(avgLevel[0]?.avg || 0) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/accounts/:id
router.get('/:id', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/accounts
router.post('/', async (req, res) => {
  try {
    const account = new Account(req.body);
    const saved = await account.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/accounts/:id
router.put('/:id', async (req, res) => {
  try {
    const account = await Account.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/accounts/:id/status — quick status update
router.patch('/:id/status', async (req, res) => {
  try {
    const { accountStatus, salesStatus } = req.body;
    const update = {};
    if (accountStatus) update.accountStatus = accountStatus;
    if (salesStatus) update.salesStatus = salesStatus;
    const account = await Account.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/accounts/bulk-update — bulk status update
router.post('/bulk-update', async (req, res) => {
  try {
    const { ids, update } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ message: 'No IDs provided' });
    const result = await Account.updateMany({ _id: { $in: ids } }, update);
    res.json({ message: `Updated ${result.modifiedCount} accounts` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/accounts (bulk)
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ message: 'No IDs provided' });
    const result = await Account.deleteMany({ _id: { $in: ids } });
    res.json({ message: `Deleted ${result.deletedCount} accounts` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/accounts/:id
router.delete('/:id', async (req, res) => {
  try {
    const account = await Account.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
