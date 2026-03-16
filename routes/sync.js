const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Account = require('../models/Account');
const { syncAllEligible, syncOneAccount } = require('../services/syncService');
// Allow GitHub Actions CI to call sync without JWT
router.use((req, res, next) => {
  const ciKey = req.headers['x-sync-key'];

  // Allow GitHub Actions
  if (ciKey && ciKey === process.env.SYNC_KEY) {
    console.log('[Sync] Authorized via CI key');
    return next();
  }

  // Otherwise require normal JWT auth
  return authMiddleware(req, res, next);
});
// POST /api/sync — trigger a full bulk sync manually
router.post('/', async (req, res) => {
  try {
    console.log('[Sync] Manual sync triggered');
    const result = await syncAllEligible();
    res.json({
      message: `Sync complete: ${result.synced} updated, ${result.failed} failed out of ${result.total}`,
      ...result,
    });
  } catch (err) {
    console.error('[Sync] Manual sync error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sync/:id — sync a single account by ID
router.post('/:id', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id)
      .select('_id apexUsername apexPlatform accountLevel rank salesStatus accountStatus');

    if (!account)             return res.status(404).json({ message: 'Account not found' });
    if (!account.apexUsername) return res.status(400).json({ message: 'No Apex username set on this account' });
    if (account.accountStatus === 'Banned')  return res.status(400).json({ message: 'Account is banned — skipping sync' });
    if (account.salesStatus   === 'Sold')    return res.status(400).json({ message: 'Account is sold — skipping sync' });

    const result = await syncOneAccount(account);
    res.json({ message: `Synced ${account.apexUsername} — Level ${result.level}, Rank ${result.rank}`, ...result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sync/status — count how many accounts are eligible
router.get('/status', async (req, res) => {
  try {
    const eligible = await Account.countDocuments({
      salesStatus:   'Unsold',
      accountStatus: { $ne: 'Banned' },
      apexUsername:  { $nin: ['', null], $exists: true },
    });
    const total = await Account.countDocuments();
    res.json({ eligible, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
