const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const BotLog = require('../models/BotLog');
const BotStatus = require('../models/BotStatus');
const authMiddleware = require('../middleware/auth');

// Bot is considered offline if no heartbeat for this long
const OFFLINE_AFTER_MS = 20 * 1000;

// ── Bot key auth (used by the Python script, no JWT) ────────────────────────
function botKeyAuth(req, res, next) {
  const expected = process.env.BOT_KEY;
  if (!expected) return res.status(503).json({ message: 'BOT_KEY not configured on server' });
  const given = String(req.headers['x-bot-key'] || '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: 'Invalid bot key' });
  }
  next();
}

// POST /api/bot/logs  — body: { logs: [{ level, message, ts }], cycle?, host? }
router.post('/logs', botKeyAuth, async (req, res) => {
  try {
    const logs = Array.isArray(req.body.logs) ? req.body.logs.slice(0, 100) : [];
    const docs = logs
      .filter(l => l && typeof l.message === 'string' && l.message.trim())
      .map(l => ({
        level: ['info', 'success', 'warn', 'error'].includes(l.level) ? l.level : 'info',
        message: l.message.slice(0, 500),
        ts: l.ts ? new Date(l.ts) : new Date()
      }));
    if (docs.length) await BotLog.insertMany(docs, { ordered: true });

    await BotStatus.findOneAndUpdate(
      { key: 'main' },
      { key: 'main', state: 'running', lastSeen: new Date(),
        ...(req.body.cycle != null ? { cycle: Number(req.body.cycle) || 0 } : {}),
        ...(req.body.host ? { host: String(req.body.host).slice(0, 60) } : {}) },
      { upsert: true }
    );
    res.json({ ok: true, saved: docs.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/bot/heartbeat — body: { state: 'running' | 'stopped', cycle?, host? }
router.post('/heartbeat', botKeyAuth, async (req, res) => {
  try {
    const state = req.body.state === 'stopped' ? 'stopped' : 'running';
    const existing = await BotStatus.findOne({ key: 'main' }).lean();
    const wasDown = !existing || existing.state !== 'running' ||
      !existing.lastSeen || Date.now() - new Date(existing.lastSeen).getTime() > OFFLINE_AFTER_MS;

    const update = { key: 'main', state, lastSeen: new Date() };
    if (req.body.cycle != null) update.cycle = Number(req.body.cycle) || 0;
    if (req.body.host) update.host = String(req.body.host).slice(0, 60);
    if (state === 'running' && wasDown) update.startedAt = new Date();

    await BotStatus.findOneAndUpdate({ key: 'main' }, update, { upsert: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/bot/feed?after=<lastLogId>  (JWT) — status + new logs in one call
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const { after } = req.query;
    let logs;
    if (after && /^[a-f\d]{24}$/i.test(after)) {
      logs = await BotLog.find({ _id: { $gt: after } }).sort({ _id: 1 }).limit(500).lean();
    } else {
      logs = (await BotLog.find().sort({ _id: -1 }).limit(200).lean()).reverse();
    }

    const s = await BotStatus.findOne({ key: 'main' }).lean();
    const lastSeenMs = s?.lastSeen ? new Date(s.lastSeen).getTime() : 0;
    const active = !!s && s.state === 'running' && Date.now() - lastSeenMs < OFFLINE_AFTER_MS;

    res.json({
      status: {
        active,
        state: active ? 'active' : 'offline',
        cycle: s?.cycle || 0,
        host: s?.host || '',
        lastSeen: s?.lastSeen || null,
        startedAt: s?.startedAt || null
      },
      logs: logs.map(l => ({ id: l._id, level: l.level, message: l.message, ts: l.ts })),
      serverTime: new Date()
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/bot/logs (JWT) — clear stored logs
router.delete('/logs', authMiddleware, async (req, res) => {
  try {
    await BotLog.deleteMany({});
    res.json({ message: 'Logs cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;