/**
 * One-command local dev: embedded Postgres → schema sync → API + Mini App.
 * Usage: npm run dev
 */
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const PORT = Number(process.env.LOCAL_DB_PORT || 5432);
const children = [];
let weStartedDb = false;

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.on("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function run(cmd, args, opts = {}) {
  const { track = true, ...spawnOpts } = opts;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env },
      ...spawnOpts,
    });
    if (track) children.push(child);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`));
    });
    child.on("error", reject);
  });
}

function spawnBg(cmd, args, name, opts = {}) {
  const { fatalOnExit = true } = opts;
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env },
  });
  children.push(child);
  child.on("exit", (code) => {
    if (code !== 0 && code !== null && fatalOnExit) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(1);
    }
  });
  return child;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Port open ≠ Postgres ready for queries (especially after unclean shutdown). Retry schema sync. */
async function syncSchema(maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await run("npm", ["run", "db:push", "-w", "@taxi/api"], { track: false });
      return;
    } catch {
      if (attempt === maxAttempts) {
        throw new Error(
          "Could not sync schema — PostgreSQL did not become ready in time. " +
            "Stop any old dev processes, delete apps/api/.localdb if needed, and run npm run dev again.",
        );
      }
      if (attempt === 1) {
        console.log("      Waiting for PostgreSQL to finish starting…");
      } else if (attempt % 5 === 0) {
        console.log(`      Still waiting… (${attempt}/${maxAttempts})`);
      }
      await sleep(1000);
    }
  }
}

function waitForPort(port, timeoutMs = 120_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = createConnection({ port, host: "127.0.0.1" });
      socket.on("connect", () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for PostgreSQL on port ${port}`));
          return;
        }
        setTimeout(tryConnect, 500);
      });
    };
    tryConnect();
  });
}

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function ensurePostgres() {
  if (await isPortOpen(PORT)) {
    console.log(`[1/4] PostgreSQL already running on port ${PORT} (reusing it).`);
    console.log("      Tip: if the app misbehaves, stop all terminals and run npm run dev again.\n");
    return;
  }

  console.log("[1/4] Starting local PostgreSQL…");
  weStartedDb = true;
  spawnBg("npm", ["run", "dev:db"], "db");
  await waitForPort(PORT);
  console.log(`      PostgreSQL listening on port ${PORT}.\n`);
}

async function main() {
  const withBot = process.argv.includes("--telegram") || process.env.WITH_BOT === "true";

  console.log("\n🚕 Taxi Fleet Manager — local dev\n");

  await ensurePostgres();

  console.log("[2/4] Syncing database schema…");
  await syncSchema();
  console.log("      Schema is up to date.\n");

  console.log("[3/4] Starting API (http://localhost:3000)…");
  spawnBg("npm", ["run", "dev:api"], "api");

  console.log("[4/4] Starting Mini App (http://localhost:5173)…");
  spawnBg("npm", ["run", "dev:miniapp"], "miniapp");

  if (withBot) {
    printTelegramSetup();
    console.log("[5/5] Starting Telegram bot (long polling)…");
    spawnBg("npm", ["run", "dev:bot"], "bot");
    console.log("\n✅ Local stack + bot running. Open your bot in Telegram and tap Open app.");
  } else {
    console.log("\n✅ Ready — open http://localhost:5173 in your browser.");
  }

  console.log("   Press Ctrl+C here to stop everything.\n");
}

function printTelegramSetup() {
  const url = process.env.PUBLIC_URL ?? "";
  console.log("\n--- Telegram Mini App (local, no deploy) ---");
  if (!url.startsWith("https://")) {
    console.log("Telegram requires HTTPS. Before opening the app in Telegram:");
    console.log("  1. One-time: npm run ngrok:auth -- YOUR_TOKEN");
    console.log("  2. In a SECOND terminal run:  npm run dev:tunnel");
    console.log("  3. Paste the ngrok URL in @BotFather → Menu button → Web App (also auto-saved to .env)");
    console.log("  4. Set DEV_BYPASS_AUTH=false in .env, restart npm run dev:telegram");
  } else {
    console.log(`PUBLIC_URL is set: ${url}`);
    console.log("Make sure @BotFather Menu button / Web App URL matches this exactly.");
    console.log("Use DEV_BYPASS_AUTH=false when testing inside Telegram.");
  }
  console.log("Your TELEGRAM_SUPERADMIN_ID must be your real numeric Telegram ID.\n");
}

main().catch((err) => {
  console.error(err);
  shutdown(1);
});
