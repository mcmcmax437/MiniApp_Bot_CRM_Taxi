/**
 * Force Telegram's persistent menu button to use the current PUBLIC_URL.
 * Useful after changing tunnels, because old menu/button URLs can stay cached.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const token = process.env.BOT_TOKEN;
const publicUrl = process.env.PUBLIC_URL;

if (!token) {
  console.error("Missing BOT_TOKEN in .env");
  process.exit(1);
}

if (!publicUrl?.startsWith("https://")) {
  console.error("PUBLIC_URL must be an https:// URL in .env");
  process.exit(1);
}

async function telegram(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.description ?? `${method} failed with HTTP ${res.status}`);
  }
  return data.result;
}

await telegram("setChatMenuButton", {
  menu_button: {
    type: "web_app",
    text: "Open app",
    web_app: { url: publicUrl },
  },
});

const me = await telegram("getMe", {});
console.log(`Telegram menu synced for @${me.username}: ${publicUrl}`);
console.log("Now send /start in Telegram and use the newest Open app button.");
