/**
 * Run any command with repo-root .env and auto-built DATABASE_URL.
 */
import { spawnSync } from "node:child_process";
import { apiDir, ensureDatabaseUrl } from "./load-env.mjs";

ensureDatabaseUrl();

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/run-with-env.mjs <command> [args…]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  cwd: apiDir,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
