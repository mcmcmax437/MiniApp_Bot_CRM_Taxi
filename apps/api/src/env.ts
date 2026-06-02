import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from the current working directory and, as a fallback, the repo root
// (so a single root .env works no matter which workspace folder we run from).
dotenv.config();
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function databaseUrl(): string {
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const user = optional("POSTGRES_USER", "taxi");
  const password = optional("POSTGRES_PASSWORD", "taxi");
  const db = optional("POSTGRES_DB", "taxi");
  const host = optional("POSTGRES_HOST", "localhost");
  const port = optional("LOCAL_DB_PORT", "5432");

  return (
    `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
    `@${host}:${port}/${db}?schema=public`
  );
}

export const env = {
  botToken: required("BOT_TOKEN"),
  superAdminId: optional("TELEGRAM_SUPERADMIN_ID", "0"),
  publicUrl: optional("PUBLIC_URL", "http://localhost:5173"),
  databaseUrl: databaseUrl(),
  port: Number(optional("API_PORT", "3000")),
  corsOrigins: optional("CORS_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  runScheduler: optional("RUN_SCHEDULER", "false").toLowerCase() === "true",
  reminderDaysBefore: Number(optional("REMINDER_DAYS_BEFORE", "7")),
  reminderCron: optional("REMINDER_CRON", "0 9 * * *"),
  // Reject Telegram initData older than this (seconds). 24h default.
  initDataMaxAgeSeconds: Number(optional("INIT_DATA_MAX_AGE", "86400")),
  uploadsDir: optional("UPLOADS_DIR", "./uploads"),
  nodeEnv: optional("NODE_ENV", "development"),
  // Local development only: when true and no Telegram initData is present, the API
  // authenticates as a fake ACTIVE super-admin owner so the app can be opened in a
  // normal browser. Ignored when NODE_ENV=production.
  devBypassAuth: optional("DEV_BYPASS_AUTH", "false").toLowerCase() === "true",
  devUserId: optional("DEV_USER_ID", "999999999"),
};

export const devBypassEnabled = (): boolean =>
  env.devBypassAuth && env.nodeEnv !== "production";

export const isSuperAdmin = (telegramUserId: bigint | string): boolean => {
  return String(telegramUserId) === String(env.superAdminId) && env.superAdminId !== "0";
};
