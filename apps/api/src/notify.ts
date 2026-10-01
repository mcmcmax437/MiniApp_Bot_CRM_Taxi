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

/** Send a file to a Telegram chat. Bot uploads are limited to 50 MB. */
export async function sendTelegramDocument(
  chatId: bigint | string,
  filename: string,
  content: Uint8Array,
  caption: string,
): Promise<void> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption.slice(0, 1000));
  form.append("document", new Blob([content]), filename);
  const res = await fetch(`https://api.telegram.org/bot${env.botToken}/sendDocument`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram sendDocument failed (${res.status}): ${body}`);
  }
}
