/**
 * Load repo-root .env and ensure DATABASE_URL is set from MYSQL_* when omitted.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertMysqlDatabaseUrl, buildMysqlDatabaseUrl } from "./mysql-url.mjs";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(apiDir, "../..");

dotenv.config({ path: path.join(rootDir, ".env") });

export function ensureDatabaseUrl() {
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) {
    assertMysqlDatabaseUrl(explicit);
    return explicit;
  }

  const user = process.env.MYSQL_USER || "taxi";
  const password = process.env.MYSQL_PASSWORD || "taxi";
  const db = process.env.MYSQL_DATABASE || "taxi";
  const host = process.env.MYSQL_HOST || "localhost";
  const port = process.env.LOCAL_DB_PORT || "3306";

  process.env.DATABASE_URL = buildMysqlDatabaseUrl({
    user,
    password,
    host,
    port,
    database: db,
  });

  return process.env.DATABASE_URL;
}

export { apiDir, rootDir };

ensureDatabaseUrl();
