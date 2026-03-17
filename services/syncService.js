/**
 * Apex Legends Account Sync Service (Updated with Telegram Notifications)
 * - Calls mozambiquehe.re API for each eligible account (Unsold + Unbanned + has apexUsername)
 * - Updates accountLevel and rank
 * - Runs automatically every 12 hours
 * - Can also be triggered manually via POST /api/accounts/sync
 * - Sends Telegram messages for every sync (manual/auto) and errors
 */

const Account = require('../models/Account');
const { notifyTelegram } = require('../utils/telegram'); // Telegram notification helper

// Use built-in fetch (Node 18+) or fall back to node-fetch
let fetchFn;
try {
  fetchFn = fetch;
} catch {
  try {
    fetchFn = require('node-fetch');
  } catch {
    console.error('[Sync] node-fetch not available and Node < 18. Sync will not work.');
  }
}

// ── Rank mapping ────────────────────────────────────────────────────────────
const DIV_ROMAN = { 4: 'IV', 3: 'III', 2: 'II', 1: 'I' };

function parseRank(rankName, rankDiv) {
  if (!rankName || rankName === 'Unranked') return 'Unranked';
  const name = rankName.charAt(0).toUpperCase() + rankName.slice(1).toLowerCase();
  if (name === 'Master' || name === 'Predator') return name;
  const roman = DIV_ROMAN[parseInt(rankDiv)];
  if (!roman) return 'Unranked';
  const candidate = `${name} ${roman}`;
  const valid = [
    'Bronze IV','Bronze III','Bronze II','Bronze I',
    'Silver IV','Silver III','Silver II','Silver I',
    'Gold IV','Gold III','Gold II','Gold I',
    'Platinum IV','Platinum III','Platinum II','Platinum I',
    'Diamond IV','Diamond III','Diamond II','Diamond I',
    'Master','Predator'
  ];
  return valid.includes(candidate) ? candidate : 'Unranked';
}

// ── Single account sync ─────────────────────────────────────────────────────
async function syncOneAccount(account) {
  const apiKey = process.env.APEX_API_KEY;
  if (!apiKey) throw new Error('APEX_API_KEY not set in environment');

  const url = `https://api.mozambiquehe.re/bridge?auth=${encodeURIComponent(apiKey)}&player=${encodeURIComponent(account.apexUsername)}&platform=${account.apexPlatform}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  let res;
  try {
    res = await fetchFn(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body.slice(0, 120)}`);
  }

  const data = await res.json();
  if (!data?.global) throw new Error('Unexpected API response — no global object');
  if (data.Error)    throw new Error(`API error: ${data.Error}`);

  const newLevel = data.global.level != null ? data.global.level : account.accountLevel;
  const newRank  = data.global.rank
    ? parseRank(data.global.rank.rankName, data.global.rank.rankDiv)
    : account.rank;

  // Check if there was an actual change
  const levelChanged = newLevel !== account.accountLevel;
  const rankChanged = newRank !== account.rank;
  const hasChanged = levelChanged || rankChanged;

  await Account.findByIdAndUpdate(account._id, {
    accountLevel: newLevel,
    rank: newRank,
    lastSynced: new Date(),
    syncError: '',
  });

  return {
    id: account._id,
    username: account.apexUsername,
    email: account.accountEmail,
    oldLevel: account.accountLevel,
    newLevel,
    oldRank: account.rank,
    newRank,
    levelChanged,
    rankChanged,
    hasChanged,
    ok: true
  };
}

// ── Bulk sync ───────────────────────────────────────────────────────────────
async function syncAllEligible(isManual = false) {
  const accounts = await Account.find({
    salesStatus:   'Unsold',
    accountStatus: { $ne: 'Banned' },
    apexUsername:  { $nin: ['', null], $exists: true },
  }).select('_id apexUsername apexPlatform accountLevel rank accountEmail');

  const startTime = new Date();
  console.log(`[Sync] Started bulk sync at ${startTime.toISOString()} | Manual: ${isManual}`);
  await notifyTelegram(`[Sync] Started bulk sync at ${startTime.toISOString()} | ${isManual ? 'Manual' : 'Automatic'}`);

  if (!accounts.length) {
    console.log(`[Sync] No accounts to update, ending sync at ${new Date().toISOString()}`);
    await notifyTelegram(`[Sync] No accounts to update. Ending sync.`);
    return { synced: 0, checked: 0, failed: 0, total: 0, promoted: [], results: [] };
  }

  const results = [];
  const promoted = [];
  let synced = 0, checked = 0, failed = 0;

  for (const acc of accounts) {
    const accountStart = new Date();
    try {
      console.log(`[Sync] Checking account: ${acc.apexUsername} (ID: ${acc._id}) at ${accountStart.toISOString()}`);
      const r = await syncOneAccount(acc);
      results.push(r);
      checked++;

      if (r.hasChanged) {
        synced++;
        const promotionSummary = [];
        if (r.levelChanged) promotionSummary.push(`Level ${r.oldLevel}→${r.newLevel}`);
        if (r.rankChanged) promotionSummary.push(`Rank ${r.oldRank}→${r.newRank}`);
        
        const promotedEntry = {
          username: r.username,
          email: r.email,
          changes: promotionSummary.join(', ')
        };
        promoted.push(promotedEntry);

        console.log(`[Sync] Promoted: ${acc.apexUsername} (${promotionSummary.join(', ')}) at ${new Date().toISOString()}`);
      } else {
        console.log(`[Sync] No changes for ${acc.apexUsername} at ${new Date().toISOString()}`);
      }
    } catch (err) {
      await Account.findByIdAndUpdate(acc._id, {
        syncError: err.message,
        lastSynced: new Date(),
      }).catch(() => {});
      results.push({ id: acc._id, username: acc.apexUsername, ok: false, error: err.message });
      checked++;
      failed++;
      console.error(`[Sync] Failed: ${acc.apexUsername} — ${err.message} at ${new Date().toISOString()}`);
      await notifyTelegram(`[Sync Error] ${acc.apexUsername} — ${err.message}`);
    }
    // Rate limiting: 600ms between calls
    await new Promise(r => setTimeout(r, 600));
  }

  const endTime = new Date();
  let summaryMessage = `[Sync] Finished: ${synced} promoted, ${checked - synced - failed} unchanged, ${failed} failed | Duration: ${(endTime - startTime)/1000}s`;
  
  if (promoted.length > 0) {
    const promotionList = promoted.map(p => `• ${p.username} (${p.email}): ${p.changes}`).join('\n');
    summaryMessage += `\n\n🚀 Promoted:\n${promotionList}`;
  }

  console.log(`[Sync] Bulk sync finished at ${endTime.toISOString()} — ${synced}/${checked} promoted, ${checked - synced - failed} unchanged, ${failed} failed`);
  await notifyTelegram(summaryMessage);

  return { synced, checked, failed, total: accounts.length, promoted, results };
}

// ── Hourly cron ─────────────────────────────────────────────────────────────
let cronTimer = null;
const HOUR_MS = 12 * 60 * 60 * 1000; // 12 hours

function startCron() {
  if (cronTimer) return;
  const run = async () => {
    console.log('[Sync] Hourly auto-sync starting…');
    try {
      await syncAllEligible(false); // false = automatic
    } catch (err) {
      console.error('[Sync] Hourly error:', err.message);
      await notifyTelegram(`[Sync Cron Error] ${err.message}`);
    }
  };
  setTimeout(run, 10_000); // first run 10s after startup
  cronTimer = setInterval(run, HOUR_MS);
  console.log('[Sync] Auto-sync cron registered (every 12 hours)');
}

function stopCron() {
  if (cronTimer) { clearInterval(cronTimer); cronTimer = null; }
}

module.exports = { syncAllEligible, syncOneAccount, startCron, stopCron, parseRank };