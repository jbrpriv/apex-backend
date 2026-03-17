// Use built-in fetch (Node 18+) or fall back to node-fetch
let fetchFn;
try {
  // Node 18+ has built-in fetch
  fetchFn = fetch;
} catch {
  // Fall back to node-fetch for older Node versions
  try {
    fetchFn = require('node-fetch');
  } catch {
    console.warn('[Telegram] node-fetch not installed and Node < 18. Telegram notifications disabled.');
    fetchFn = null;
  }
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function notifyTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[Telegram] Skipped (bot token or chat ID not configured)');
    return;
  }

  if (!fetchFn) {
    console.warn('[Telegram] Fetch not available. Telegram notifications disabled.');
    return;
  }

  try {
    const res = await fetchFn(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message })
      }
    );
    const data = await res.json();
    console.log('[Telegram] Message sent:', data.ok);
  } catch (err) {
    console.error('[Telegram] Error:', err.message);
  }
}

module.exports = { notifyTelegram };