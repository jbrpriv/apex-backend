import fetch from 'node-fetch'; // skip if Node 18+ has built-in fetch

const TELEGRAM_BOT_TOKEN = "YOUR_BOT_TOKEN"; // replace with your bot token
const CHAT_ID = "YOUR_CHAT_ID"; // replace with your user chat ID

export async function notifyTelegram(message) {
    try {
        const res = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: CHAT_ID, text: message })
            }
        );
        const data = await res.json();
        console.log("Telegram message sent:", data.ok);
    } catch (err) {
        console.error("Telegram error:", err);
    }
}