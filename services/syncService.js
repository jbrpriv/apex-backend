/**
 * Apex Legends Account Sync Service
 * - Calls mozambiquehe.re API for each eligible account (Unsold + Unbanned + has apexUsername)
 * - Updates accountLevel and rank
 * - Runs automatically every hour
 * - Can also be triggered manually via POST /api/accounts/sync
 */

const Account = require('../models/Account');

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
    res = await fetch(url, { signal: controller.signal });
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

  const level = data.global.level != null ? data.global.level : account.accountLevel;
  const rank  = data.global.rank
    ? parseRank(data.global.rank.rankName, data.global.rank.rankDiv)
    : account.rank;

  await Account.findByIdAndUpdate(account._id, {
    accountLevel: level,
    rank,
    lastSynced: new Date(),
    syncError: '',
  });

  return { id: account._id, username: account.apexUsername, level, rank, ok: true };
}

// ── Bulk sync ───────────────────────────────────────────────────────────────
async function syncAllEligible() {
  const accounts = await Account.find({
    salesStatus:   'Unsold',
    accountStatus: { $ne: 'Banned' },
    apexUsername:  { $nin: ['', null], $exists: true },
  }).select('_id apexUsername apexPlatform accountLevel rank');

  const startTime = new Date();
  console.log(`[Sync] Started bulk sync at ${startTime.toISOString()}`);
  console.log(`[Sync] Total eligible accounts: ${accounts.length}`);

  if (!accounts.length) {
    console.log(`[Sync] No accounts to update, ending sync at ${new Date().toISOString()}`);
    return { synced: 0, failed: 0, total: 0, results: [] };
  }

  const results = [];
  let synced = 0, failed = 0;

  for (const acc of accounts) {
    const accountStart = new Date();
    try {
      console.log(`[Sync] Updating account: ${acc.apexUsername} (ID: ${acc._id}) at ${accountStart.toISOString()}`);
      const r = await syncOneAccount(acc);
      results.push(r);
      synced++;
      console.log(`[Sync] Success: ${acc.apexUsername} updated to level ${r.level}, rank ${r.rank} at ${new Date().toISOString()}`);
    } catch (err) {
      await Account.findByIdAndUpdate(acc._id, {
        syncError: err.message,
        lastSynced: new Date(),
      }).catch(() => {});
      results.push({ id: acc._id, username: acc.apexUsername, ok: false, error: err.message });
      failed++;
      console.error(`[Sync] Failed: ${acc.apexUsername} — ${err.message} at ${new Date().toISOString()}`);
    }
    // Rate limiting: 600ms between calls
    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`[Sync] Bulk sync finished at ${new Date().toISOString()} — ${synced}/${accounts.length} updated, ${failed} failed`);
  return { synced, failed, total: accounts.length, results };
}


// ── Hourly cron ─────────────────────────────────────────────────────────────
let cronTimer = null;
const HOUR_MS = 12 * 60 * 60 * 1000; // 12 hours

function startCron() {
  if (cronTimer) return;
  const run = async () => {
    console.log('[Sync] Hourly auto-sync starting…');
    try {
      await syncAllEligible();
    } catch (err) {
      console.error('[Sync] Hourly error:', err.message);
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