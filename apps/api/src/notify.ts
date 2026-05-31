import { env } from "./env.js";

/** Send a Telegram message to a chat via the Bot API (used by the scheduler). */
export async function sendTelegramMessage(chatId: bigint | string, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${env.botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: String(chatId),
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed (${res.status}): ${body}`);
  }
}
