const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const authMiddleware = require('../middleware/auth');

// All routes protected
router.use(authMiddleware);

// GET all accounts with optional filters
router.get('/', async (req, res) => {
  try {
    const { accountStatus, salesStatus, search } = req.query;
    let filter = {};

    if (accountStatus) filter.accountStatus = accountStatus;
    if (salesStatus) filter.salesStatus = salesStatus;
    if (search) {
      filter.$or = [
        { accountEmail: { $regex: search, $options: 'i' } },
        { accountRecovery: { $regex: search, $options: 'i' } }
      ];
    }

    const accounts = await Account.find(filter).sort({ createdAt: -1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET stats
router.get('/stats', async (req, res) => {
  try {
    const total = await Account.countDocuments();
    const sold = await Account.countDocuments({ salesStatus: 'Sold' });
    const unsold = await Account.countDocuments({ salesStatus: 'Unsold' });
    const banned = await Account.countDocuments({ accountStatus: 'Banned' });
    const unbanned = await Account.countDocuments({ accountStatus: 'Unbanned' });
    const newAcc = await Account.countDocuments({ accountStatus: 'New' });
    res.json({ total, sold, unsold, banned, unbanned, new: newAcc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single account
router.get('/:id', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE account
router.post('/', async (req, res) => {
  try {
    const account = new Account(req.body);
    const saved = await account.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// UPDATE account
router.put('/:id', async (req, res) => {
  try {
    const account = await Account.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE account
router.delete('/:id', async (req, res) => {
  try {
    const account = await Account.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE multiple accounts
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.body;
    await Account.deleteMany({ _id: { $in: ids } });
    res.json({ message: 'Accounts deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
