/**
 * HTTPS tunnel via ngrok → local Mini App (port 5173).
 * Auto-writes PUBLIC_URL to .env and syncs the Telegram menu button.
 *
 * One-time setup:
 *   1. Sign up at https://ngrok.com (free)
 *   2. Copy your authtoken from the dashboard
 *   3. Run:  npm run ngrok:auth -- YOUR_TOKEN
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const PORT = process.env.MINIAPP_PORT || "5173";
const envPath = path.join(root, ".env");
const tunnelUrlPath = path.join(root, ".tunnel-url");
const configuredPublicUrl = process.env.PUBLIC_URL ?? "";

function findNgrok() {
  const localAppData = process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Local");
  const candidates = [
    process.env.NGROK_PATH,
    path.join(localAppData, "Microsoft", "WinGet", "Links", "ngrok.exe"),
    "C:\\Program Files\\ngrok\\ngrok.exe",
    "C:\\Program Files (x86)\\ngrok\\ngrok.exe",
    "ngrok",
  ].filter(Boolean);

  for (const c of candidates) {
    if (c === "ngrok") return c;
    if (existsSync(c)) return c;
  }
  return null;
}

function updateEnvPublicUrl(publicUrl) {
  if (!existsSync(envPath)) {
    console.warn("No .env file found — create one from .env.example");
    return;
  }
  let content = readFileSync(envPath, "utf8");
  if (/^PUBLIC_URL=/m.test(content)) {
    content = content.replace(/^PUBLIC_URL=.*/m, `PUBLIC_URL=${publicUrl}`);
  } else {
    content += `\nPUBLIC_URL=${publicUrl}\n`;
  }
  if (/^CORS_ORIGINS=/m.test(content)) {
    content = content.replace(
      /^CORS_ORIGINS=.*/m,
      `CORS_ORIGINS=http://localhost:5173,${publicUrl}`,
    );
  }
  writeFileSync(envPath, content);
  writeFileSync(tunnelUrlPath, `${publicUrl}\n`);
}

function syncTelegramMenu() {
  if (!process.env.BOT_TOKEN) {
    console.log("  Skipping Telegram menu sync (no BOT_TOKEN in .env).");
    return;
  }
  console.log("  Syncing Telegram menu button with Telegram API…");
  const result = spawnSync(process.execPath, [path.join(root, "scripts/sync-telegram-menu.mjs")], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    console.warn("  Could not sync menu button — run: npm run telegram:menu");
  }
}

function printActiveUrl(publicUrl) {
  console.log("\n" + "=".repeat(72));
  console.log("  ACTIVE NGROK URL:");
  console.log(`  ${publicUrl}`);
  console.log("=".repeat(72));
  console.log("  1. @BotFather → /mybots → your bot → Bot Settings → Menu Button → Web App");
  console.log("     Paste the URL above if it differs from what BotFather shows.");
  console.log("  2. Restart dev: Ctrl+C in Terminal 1, then  npm run dev:telegram");
  console.log("  3. In Telegram send  /start  and tap the NEW \"Open app\" button.");
  console.log("     Old buttons in chat history keep stale URLs — ignore them.");
  console.log("  Saved to .env as PUBLIC_URL");
  console.log("  Inspector: http://127.0.0.1:4040");
  console.log("  Keep THIS terminal open while testing in Telegram.\n");
}

function fixedNgrokUrlArg() {
  try {
    const url = new URL(configuredPublicUrl);
    if (url.protocol === "https:" && /(^|\.)ngrok(-free)?\./i.test(url.hostname)) {
      return `--url=${url.hostname}`;
    }
  } catch {
    /* PUBLIC_URL is not a valid URL. */
  }
  return null;
}

async function fetchNgrokUrl(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("http://127.0.0.1:4040/api/tunnels");
      if (!res.ok) throw new Error("not ready");
      const data = await res.json();
      const https = data.tunnels?.find((t) => t.public_url?.startsWith("https://"));
      if (https?.public_url) return https.public_url;
    } catch {
      /* ngrok still starting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function main() {
  const bin = findNgrok();
  if (!bin) {
    console.error("\nngrok not found. Download from https://ngrok.com/download");
    console.error("Then run:  npm run ngrok:auth -- YOUR_TOKEN\n");
    process.exit(1);
  }

  console.log(`\nStarting ngrok → http://localhost:${PORT}`);
  console.log(`Using: ${bin}\n`);

  const urlArg = fixedNgrokUrlArg();
  if (urlArg) {
    console.log(`Using fixed ngrok domain from PUBLIC_URL: ${configuredPublicUrl}\n`);
  }

  const child = spawn(bin, ["http", ...(urlArg ? [urlArg] : []), PORT, "--log=stdout"], {
    shell: bin === "ngrok",
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (d) => process.stdout.write(d));
  child.stderr?.on("data", (d) => process.stderr.write(d));

  child.on("error", () => {
    console.error("\nFailed to start ngrok.");
    process.exit(1);
  });

  const url = await fetchNgrokUrl();
  if (!url) {
    console.error("Could not read ngrok URL. Open http://127.0.0.1:4040 and check the tunnel.");
    process.exit(1);
  }

  updateEnvPublicUrl(url);
  process.env.PUBLIC_URL = url;
  syncTelegramMenu();
  printActiveUrl(url);

  child.on("exit", (code) => process.exit(code ?? 0));

  process.on("SIGINT", () => {
    child.kill("SIGTERM");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
