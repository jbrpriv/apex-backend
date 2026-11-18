const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const BotLog = require('../models/BotLog');
const BotStatus = require('../models/BotStatus');
const BotFrame = require('../models/BotFrame');
const BotCommand = require('../models/BotCommand');
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

// POST /api/bot/screen — raw image/jpeg body (bot key). Keeps only the latest frame.
router.post('/screen', botKeyAuth, express.raw({ type: 'image/jpeg', limit: '2mb' }), async (req, res) => {
  try {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
      return res.status(400).json({ message: 'Expected image/jpeg body' });
    }
    await BotFrame.findOneAndUpdate(
      { key: 'main' },
      { key: 'main', image: buf, width: Number(req.headers['x-img-width']) || 0, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/bot/screen?since=<ISO> (JWT) — latest frame as a data URL, or { unchanged: true }
router.get('/screen', authMiddleware, async (req, res) => {
  try {
    const doc = await BotFrame.findOne({ key: 'main' });
    if (!doc) return res.json({ image: null });
    const since = req.query.since ? new Date(req.query.since).getTime() : 0;
    if (since && since >= doc.updatedAt.getTime()) {
      return res.json({ unchanged: true, updatedAt: doc.updatedAt });
    }
    res.json({
      image: 'data:image/jpeg;base64,' + doc.image.toString('base64'),
      width: doc.width,
      updatedAt: doc.updatedAt
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

// POST /api/bot/command (JWT) — dashboard queues a command for the bot
// body: { type: 'escBtn' | 'spaceBtn' | 'enterBtn' | 'mouse', text?: string }
router.post('/command', authMiddleware, async (req, res) => {
  try {
    const type = String(req.body.type || '');
    if (!['escBtn', 'spaceBtn', 'enterBtn', 'mouse'].includes(type)) {
      return res.status(400).json({ message: 'Invalid command type' });
    }
    const text = String(req.body.text || '').trim().slice(0, 60);
    if (type === 'mouse' && !text) {
      return res.status(400).json({ message: 'Mouse command needs a keyword' });
    }
    const cmd = await BotCommand.create({ type, text: type === 'mouse' ? text : '' });
    res.json({ ok: true, id: cmd._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/bot/commands (bot key) — bot polls this; returns and claims pending commands
router.get('/commands', botKeyAuth, async (req, res) => {
  try {
    const fresh = new Date(Date.now() - 30 * 1000);   // ignore anything older than 30s
    const commands = [];
    for (let i = 0; i < 10; i++) {
      const c = await BotCommand.findOneAndUpdate(
        { claimed: false, createdAt: { $gte: fresh } },
        { claimed: true },
        { sort: { createdAt: 1 }, new: true }
      ).lean();
      if (!c) break;
      commands.push({ id: c._id, type: c.type, text: c.text });
    }
    res.json({ commands });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;