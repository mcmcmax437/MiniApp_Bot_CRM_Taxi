/**
 * Drop the app database (MYSQL_DATABASE).
 * Uses the MySQL CLI when Prisma cannot connect (e.g. sha256_password).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMysqlDatabaseUrl, isMysqlAuthPluginError } from "./mysql-url.mjs";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(apiDir, "../..");

dotenv.config({ path: path.join(rootDir, ".env") });

const db = process.env.MYSQL_DATABASE || "taxi";
const host = process.env.MYSQL_HOST || "localhost";
const port = process.env.LOCAL_DB_PORT || "3306";

const appUser = process.env.MYSQL_USER || "taxi";
const appPassword = process.env.MYSQL_PASSWORD || "taxi";
const rootPassword = process.env.MYSQL_ROOT_PASSWORD?.trim();

const sql = `DROP DATABASE IF EXISTS \`${db}\`;`;

const MYSQL_CLI_CANDIDATES = [
  "C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe",
  "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe",
  "C:\\xampp\\mysql\\bin\\mysql.exe",
];

function findMysqlCli() {
  if (process.platform === "win32") {
    const where = spawnSync("where.exe", ["mysql"], { encoding: "utf8" });
    if (where.status === 0) {
      const first = where.stdout.trim().split(/\r?\n/).find(Boolean);
      if (first) return first;
    }
  }
  for (const bin of MYSQL_CLI_CANDIDATES) {
    if (existsSync(bin)) return bin;
  }
  const probe = spawnSync("mysql", ["--version"], {
    encoding: "utf8",
    shell: true,
  });
  if (probe.status === 0) return "mysql";
  return null;
}

const mysqlCli = findMysqlCli();

function executeDropPrisma(user, password) {
  process.env.DATABASE_URL = buildMysqlDatabaseUrl({
    user,
    password,
    host,
    port,
    database: "mysql",
  });

  const result = spawnSync(
    "npx",
    ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"],
    {
      cwd: apiDir,
      env: process.env,
      input: sql,
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { code: result.status ?? 1, output, via: "prisma" };
}

function executeDropCli(user, password) {
  if (!mysqlCli) {
    return { code: 1, output: "mysql CLI not found", via: "mysql-cli" };
  }

  const result = spawnSync(
    mysqlCli,
    [`-h${host}`, `-P${port}`, `-u${user}`, "-e", sql],
    {
      env: { ...process.env, MYSQL_PWD: password },
      encoding: "utf8",
    },
  );

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { code: result.status ?? 1, output, via: "mysql-cli" };
}

function executeDrop(user, password) {
  if (mysqlCli) {
    const cli = executeDropCli(user, password);
    if (cli.code === 0) return cli;
  }
  const prisma = executeDropPrisma(user, password);
  if (prisma.code === 0) return prisma;
  if (mysqlCli) {
    const cli = executeDropCli(user, password);
    if (cli.output || cli.code !== 0) return cli;
  }
  return prisma;
}

console.log(`Dropping database \`${db}\` on ${host}:${port}…`);
if (mysqlCli) console.log(`Using MySQL client: ${mysqlCli}`);

const attempts = [{ user: appUser, password: appPassword, label: appUser }];
if (rootPassword) {
  attempts.push({ user: "root", password: rootPassword, label: "root" });
}

let last = null;
for (const { user, password, label } of attempts) {
  last = executeDrop(user, password);
  if (last.output) console.log(last.output);
  if (last.code === 0) {
    console.log(`Done (${last.via}). Database \`${db}\` was dropped.`);
    console.log("Run npm run dev to recreate it.\n");
    process.exit(0);
  }
  console.log(`Could not drop as '${label}' (${last.via}).`);
}

if (isMysqlAuthPluginError(last?.output ?? "")) {
  console.error("\nMySQL auth plugin error. Run: npm run db:auth-help -w @taxi/api\n");
} else {
  console.error("\nCould not drop the database. Fix MYSQL_* in .env or run in Workbench:");
  console.error(`  DROP DATABASE IF EXISTS \`${db}\`;\n`);
}
process.exit(last?.code ?? 1);
