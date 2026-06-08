/**
 * Apply Prisma schema changes safely for both fresh and existing databases.
 * Used by `npm run dev` — you should not need to run Prisma commands manually.
 */
import { spawnSync } from "node:child_process";
import { apiDir, ensureDatabaseUrl } from "./load-env.mjs";
import { isMysqlAuthPluginError } from "./mysql-url.mjs";

const MIGRATION_NAME = "20250603000000_init";

/** All migrations in order — used to mark failed/pending steps as applied after db push. */
const ALL_MIGRATIONS = [
  "20250603000000_init",
  "20250604000000_car_tracking",
  "20250605000000_owner_currency",
  "20250606000000_car_purchase_tires",
  "20250607000000_car_vin_tracker",
  "20250608000000_driver_postal_code",
  "20250609000000_document_meta",
  "20250610000000_payment_partner_expense",
];

function failedMigrationName(output) {
  const match = output.match(/Migration name:\s*(\S+)/i);
  return match?.[1] ?? null;
}

function reconcileAfterPush() {
  const push = runPrisma(["db", "push", "--skip-generate"]);
  if (push.code !== 0) {
    if (isMysqlAuthPluginError(push.output)) failAuthPlugin();
    return false;
  }

  const pushOut = push.output.toLowerCase();
  if (!pushOut.includes("already in sync") && !pushOut.includes("in sync")) {
    return false;
  }

  for (const name of ALL_MIGRATIONS) {
    runPrisma(["migrate", "resolve", "--applied", name]);
  }

  const gen = runPrisma(["generate"]);
  if (gen.code !== 0) {
    fail("Prisma client generation failed.");
  }
  console.log("Database schema is up to date.\n");
  process.exit(0);
}

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

function fail(message, hint) {
  console.error(`\n❌ ${message}`);
  if (hint) console.error(hint);
  console.error(
    "   Docker reset: `docker compose down -v` then `npm run dev`.\n" +
      "   Auth help: `npm run db:auth-help -w @taxi/api`\n",
  );
  process.exit(1);
}

function failAuthPlugin() {
  console.error("\n❌ MySQL authentication plugin is not supported by Prisma on this server.");
  console.error("   Fix: run `npm run db:auth-help -w @taxi/api` and execute the SQL in MySQL as admin.\n");
  process.exit(2);
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

const deployOutput = deploy.output;

if (isMysqlAuthPluginError(deployOutput)) {
  failAuthPlugin();
}

const deployLower = deployOutput.toLowerCase();

if (deployLower.includes("p1001") || deployLower.includes("can't reach database")) {
  console.error("MySQL is not reachable yet.");
  process.exit(1);
}

if (deployLower.includes("p1000") || deployLower.includes("authentication failed")) {
  fail(
    "MySQL rejected the username or password from .env.",
    "   Check MYSQL_USER / MYSQL_PASSWORD (or DATABASE_URL) match your local MySQL account.",
  );
}

// Failed migration (P3009 / P3018) — reconcile with db push, then mark migrations applied.
if (
  deployLower.includes("p3009") ||
  deployLower.includes("p3018") ||
  deployLower.includes("failed migration")
) {
  const failed = failedMigrationName(deploy.output);
  console.log(
    failed
      ? `Failed migration detected (${failed}) — checking whether schema already matches…`
      : "Failed migration detected — checking whether schema already matches…",
  );

  if (failed) {
    runPrisma(["migrate", "resolve", "--rolled-back", failed]);
    const retry = runPrisma(["migrate", "deploy"]);
    if (retry.code === 0) {
      const gen = runPrisma(["generate"]);
      if (gen.code !== 0) fail("Prisma client generation failed.");
      console.log("Database schema is up to date.\n");
      process.exit(0);
    }
  }

  reconcileAfterPush();
}

// Fresh database: tables do not exist yet — bootstrap with db push, then record migration.
const looksLikeFreshDb =
  deployLower.includes("does not exist") || deployLower.includes("no migration found");

if (looksLikeFreshDb) {
  console.log("Fresh database detected — creating tables…");
  const push = runPrisma(["db", "push", "--skip-generate"]);
  if (push.code !== 0) {
    if (isMysqlAuthPluginError(push.output)) failAuthPlugin();
    fail("Could not create the initial database schema.");
  }

  for (const name of ALL_MIGRATIONS) {
    const resolve = runPrisma(["migrate", "resolve", "--applied", name]);
    if (resolve.code !== 0) {
      fail(`Could not register migration ${name} after schema bootstrap.`);
    }
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
