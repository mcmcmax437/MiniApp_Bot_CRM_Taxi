/**
 * Run a Prisma CLI command with repo-root .env and auto-built DATABASE_URL.
 */
import { spawnSync } from "node:child_process";
import { apiDir, ensureDatabaseUrl } from "./load-env.mjs";

ensureDatabaseUrl();

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: node scripts/run-prisma.mjs <prisma-args…>");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  cwd: apiDir,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
