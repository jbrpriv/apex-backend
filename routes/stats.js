const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/stats/overview
router.get('/overview', async (req, res) => {
  try {
    const [total, sold, unsold, banned, unbanned, newAcc] = await Promise.all([
      Account.countDocuments(),
      Account.countDocuments({ salesStatus: 'Sold' }),
      Account.countDocuments({ salesStatus: 'Unsold' }),
      Account.countDocuments({ accountStatus: 'Banned' }),
      Account.countDocuments({ accountStatus: 'Unbanned' }),
      Account.countDocuments({ accountStatus: 'New' }),
    ]);
    const avgLevelAgg = await Account.aggregate([{ $group: { _id: null, avg: { $avg: '$accountLevel' } } }]);
    const avgLevel = Math.round(avgLevelAgg[0]?.avg || 0);
    res.json({ total, sold, unsold, banned, unbanned, new: newAcc, avgLevel });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/stats/level-distribution
router.get('/level-distribution', async (req, res) => {
  try {
    const ranges = [
      { label: '1–10',   min: 1,  max: 10 },
      { label: '11–20',  min: 11, max: 20 },
      { label: '21–50',  min: 21, max: 50 },
      { label: '51–100', min: 51, max: 100 },
      { label: '100+',   min: 101, max: 99999 },
    ];
    const result = await Promise.all(ranges.map(async r => ({
      label: r.label,
      count: await Account.countDocuments({ accountLevel: { $gte: r.min, $lte: r.max } })
    })));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/stats/recent — last 7 days added
router.get('/recent', async (req, res) => {
  try {
    const days = 7;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date(); start.setDate(start.getDate() - i); start.setHours(0,0,0,0);
      const end = new Date(start); end.setHours(23,59,59,999);
      const count = await Account.countDocuments({ createdAt: { $gte: start, $lte: end } });
      result.push({ date: start.toISOString().split('T')[0], count });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
