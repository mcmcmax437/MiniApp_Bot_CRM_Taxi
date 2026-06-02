/**
 * Load repo-root .env and ensure DATABASE_URL is set from POSTGRES_* when omitted.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(apiDir, "../..");

dotenv.config({ path: path.join(rootDir, ".env") });

export function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.POSTGRES_USER || "taxi";
  const password = process.env.POSTGRES_PASSWORD || "taxi";
  const db = process.env.POSTGRES_DB || "taxi";
  const host = process.env.POSTGRES_HOST || "localhost";
  const port = process.env.LOCAL_DB_PORT || "5432";

  process.env.DATABASE_URL =
    `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
    `@${host}:${port}/${db}?schema=public`;

  return process.env.DATABASE_URL;
}

export { apiDir, rootDir };

ensureDatabaseUrl();
