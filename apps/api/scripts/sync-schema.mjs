/**
 * Apply Prisma schema changes safely for both fresh and existing databases.
 * Used by `npm run dev` — you should not need to run Prisma commands manually.
 */
import { spawnSync } from "node:child_process";
import { apiDir, ensureDatabaseUrl } from "./load-env.mjs";

const MIGRATION_NAME = "20250601120000_driver_profile_and_agreement_deposit";

function runPrisma(args) {
  const result = spawnSync("npx", ["prisma", ...args], {
    cwd: apiDir,
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (output) {
    console.log(output);
  }

  return { code: result.status ?? 1, output };
}

function fail(message) {
  console.error(`\n❌ ${message}`);
  console.error("   Local reset (wipes test data): delete the apps/api/.localdb folder, then run npm run dev again.\n");
  process.exit(1);
}

ensureDatabaseUrl();

console.log("Syncing database schema…");

const deploy = runPrisma(["migrate", "deploy"]);
if (deploy.code === 0) {
  const gen = runPrisma(["generate"]);
  if (gen.code !== 0) {
    fail("Prisma client generation failed.");
  }
  console.log("Database schema is up to date.\n");
  process.exit(0);
}

const deployOutput = deploy.output.toLowerCase();

if (deployOutput.includes("p1001") || deployOutput.includes("can't reach database")) {
  console.error("PostgreSQL is not reachable yet.");
  process.exit(1);
}

// Fresh database: tables do not exist yet — bootstrap with db push, then record migration.
const looksLikeFreshDb =
  deployOutput.includes("does not exist") ||
  deployOutput.includes("p3018") ||
  deployOutput.includes("no migration found");

if (looksLikeFreshDb) {
  console.log("Fresh database detected — creating tables…");
  const push = runPrisma(["db", "push", "--skip-generate"]);
  if (push.code !== 0) {
    fail("Could not create the initial database schema.");
  }

  const resolve = runPrisma(["migrate", "resolve", "--applied", MIGRATION_NAME]);
  if (resolve.code !== 0) {
    fail("Could not register the baseline migration after schema bootstrap.");
  }

  const gen = runPrisma(["generate"]);
  if (gen.code !== 0) {
    fail("Prisma client generation failed.");
  }
  console.log("Database schema is up to date.\n");
  process.exit(0);
}

fail(
  "Could not apply database migrations. Existing data may need a migration that db push cannot perform.",
);
