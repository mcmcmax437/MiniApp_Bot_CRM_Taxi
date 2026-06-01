/**
 * Run `ngrok config add-authtoken` using the ngrok binary (works even when ngrok is not on PATH).
 * Usage: npm run ngrok:auth -- YOUR_AUTHTOKEN
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const token = process.argv[2];
if (!token) {
  console.error("Usage: npm run ngrok:auth -- YOUR_AUTHTOKEN");
  console.error("Get your token at https://dashboard.ngrok.com/get-started/your-authtoken");
  process.exit(1);
}

function findNgrok() {
  const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
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

const bin = findNgrok();
if (!bin) {
  console.error("ngrok not found. Download from https://ngrok.com/download");
  process.exit(1);
}

console.log(`Using: ${bin}`);
const result = spawnSync(bin, ["config", "add-authtoken", token], {
  stdio: "inherit",
  shell: bin === "ngrok",
});

process.exit(result.status ?? 1);
