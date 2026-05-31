// Zero-install local PostgreSQL for development.
// Downloads a real PostgreSQL binary on first run, stores data in apps/api/.localdb,
// and keeps the server running until you press Ctrl+C.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", ".localdb");

const USER = process.env.POSTGRES_USER || "taxi";
const PASSWORD = process.env.POSTGRES_PASSWORD || "taxi";
const PORT = Number(process.env.LOCAL_DB_PORT || 5432);
const DB = process.env.POSTGRES_DB || "taxi";

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
});

const firstRun = !existsSync(dataDir);

async function main() {
  if (firstRun) {
    console.log("First run: initialising local PostgreSQL (this downloads a binary once)...");
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(DB);
    console.log(`Created database "${DB}".`);
  } catch {
    // database already exists
  }
  console.log("");
  console.log(`Local PostgreSQL is running on port ${PORT}.`);
  console.log(`DATABASE_URL=postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}?schema=public`);
  console.log("Leave this window open. Press Ctrl+C to stop.");
}

async function shutdown() {
  console.log("\nStopping local PostgreSQL...");
  try {
    await pg.stop();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
