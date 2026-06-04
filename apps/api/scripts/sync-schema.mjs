/**
 * Apply Prisma schema changes safely for both fresh and existing databases.
 * Used by `npm run dev` — you should not need to run Prisma commands manually.
 */
import { spawnSync } from "node:child_process";
import { apiDir, ensureDatabaseUrl } from "./load-env.mjs";
import { isMysqlAuthPluginError } from "./mysql-url.mjs";

const MIGRATION_NAME = "20250603000000_init";

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

// Fresh database: tables do not exist yet — bootstrap with db push, then record migration.
const looksLikeFreshDb =
  deployLower.includes("does not exist") ||
  deployLower.includes("p3018") ||
  deployLower.includes("no migration found");

if (looksLikeFreshDb) {
  console.log("Fresh database detected — creating tables…");
  const push = runPrisma(["db", "push", "--skip-generate"]);
  if (push.code !== 0) {
    if (isMysqlAuthPluginError(push.output)) failAuthPlugin();
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
